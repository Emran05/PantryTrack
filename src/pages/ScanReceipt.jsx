import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { importReceiptItems, processReceiptText, processReceiptImage } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { CATEGORIES, UNITS, getDefaultExpirationDate } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import { readReceiptOCR } from '../lib/ocr/readReceiptOCR';
import { readPendingScan, writePendingScan, clearPendingScan, dataUrlToBlob } from '../lib/scanPersistence';
import { getVisionConsent, setVisionConsent } from '../lib/preferences';
import './ScanReceipt.css';

// If OCR produces fewer than this many characters of usable text, we treat it
// as "OCR couldn't read the receipt" and try Gemini Vision on the original image.
const OCR_MIN_TEXT_CHARS = 40;

// Downscale before persisting/sending. A raw phone photo (~4000px, 4-8MB)
// blows past sessionStorage quota and Netlify's 6MB function-body limit on the
// vision path; ~2000px JPEG is still crisp enough for OCR and Gemini vision.
const MAX_IMAGE_DIM = 2000;
const JPEG_QUALITY = 0.85;

// Returns { dataUrl, base64, mimeType }. Falls back to the raw FileReader
// result if the canvas path fails (very old browser, decode error).
function loadAndDownscale(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.onload = (ev) => {
      const rawDataUrl = ev.target.result;
      const rawMime = rawDataUrl.substring(rawDataUrl.indexOf(':') + 1, rawDataUrl.indexOf(';'));
      const fallback = () => resolve({
        dataUrl: rawDataUrl,
        base64: rawDataUrl.substring(rawDataUrl.indexOf(',') + 1),
        mimeType: rawMime,
      });

      const img = new Image();
      img.onerror = fallback;
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
          if (scale >= 1) return fallback(); // already small enough — keep original
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve({
            dataUrl,
            base64: dataUrl.substring(dataUrl.indexOf(',') + 1),
            mimeType: 'image/jpeg',
          });
        } catch {
          fallback();
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function ScanReceipt() {
  const navigate = useNavigate();
  const { activePantry } = usePantry();
  // Two inputs because `capture` is all-or-nothing: with it, iOS Safari and
  // Android Chrome jump straight to the camera and never offer the photo
  // library; without it, there's no one-tap camera. So: one input each.
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  // Last captured scan, kept in memory so "Try again" survives a failed
  // sessionStorage persist (large photo → quota) and the 10-min blob expiry.
  const pendingRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  // 'idle' | 'ocr' | 'parsing' — drives the in-progress copy
  const [scanStage, setScanStage] = useState('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  // null | { code, message, resetLabel? }
  const [scanError, setScanError] = useState(null);
  // When on-device OCR fails, the receipt IMAGE has to go to Google to be read.
  // That is the one time a photo leaves the device, so we ask first (once) and
  // remember a yes. Non-null holds the paused params while the modal is open.
  const [visionPrompt, setVisionPrompt] = useState(null); // null | { base64, mimeType }
  const { showToast } = useToast();

  // Enrich a Gemini result into the review list, or surface a "no items"
  // banner. Shared by the OCR/text path and the vision path so the tail lives
  // in one place. Declared before runPipeline because it is a dependency of it.
  const finalizeResult = useCallback((result) => {
    if (result.fellBack) {
      showToast('Your key didn\'t work — used free tier. Update key in Settings.', 'info', { duration: 6000 });
    }
    const enriched = result.items.map((item, i) => {
      const category = CATEGORIES.find((c) => c.id === item.category) ? item.category : 'other';
      return {
        ...item,
        _key: i,
        _selected: true,
        category,
        unit: UNITS.includes(item.unit) ? item.unit : 'pcs',
        expirationDate: item.expiration_date || getDefaultExpirationDate(category, item.shelfLifeDays),
      };
    });
    if (enriched.length === 0) {
      // Success with zero items would render photo-with-no-buttons — surface
      // it through the existing error banner (which offers Try Again).
      clearPendingScan();
      setScanError({ code: 'NO_ITEMS', message: "Couldn't find any grocery items on that photo — try a clearer shot or a different receipt." });
      return;
    }
    setParsedItems(enriched);
    // Persist the parsed list — now a refresh would resume straight to review.
    writePendingScan({ parsedItems: enriched });
  }, [showToast]);

  const handleParseError = useCallback((err) => {
    console.error('Receipt parse failed:', err);
    // Keep the photo and the persisted scan blob — a retry reuses them (and
    // skips OCR entirely if it already succeeded). Discarding here forced a
    // full re-capture even when the error itself said "try again in Ns".
    let message = err.message;
    if (err.code === 'GEMINI_RATE_LIMIT') {
      const wait = err.retryDelaySeconds
        ? `try again in ${err.retryDelaySeconds}s`
        : 'try again in a moment';
      message = `Google throttled the request — ${wait}. Add your own key in Settings for more headroom.`;
    } else if (!err.code) {
      message = 'Couldn\'t process the receipt — check your connection and try again.';
    }
    setScanError({ code: err.code || 'PARSE_FAILED', message, resetLabel: err.resetLabel });
  }, []);

  // Run the OCR + parse pipeline against a pending scan blob. Both fresh
  // captures and resume-after-reload feed through here.
  // `pending` may already include ocrText/ocrLines from a previous attempt —
  // in that case OCR is skipped and we go straight to the Gemini parse.
  const runPipeline = useCallback(async (pending) => {
    if (!pending?.dataUrl) return;

    setIsProcessing(true);
    setScanError(null);
    setOcrProgress(0);

    // eslint-disable-next-line prefer-const
    let { dataUrl, base64, mimeType, ocrText, ocrLines } = pending;

    try {
      // 1) Browser OCR — skip if we've already got text from a prior attempt.
      if (!ocrText) {
        setScanStage('ocr');
        try {
          const blob = await dataUrlToBlob(dataUrl);
          const ocrResult = await readReceiptOCR(blob, setOcrProgress);
          ocrText = ocrResult.rawText || '';
          ocrLines = ocrResult.lines || [];
          // Persist as soon as OCR succeeds so a refresh now skips OCR on resume.
          writePendingScan({ ocrText, ocrLines });
        } catch (ocrErr) {
          console.warn('OCR failed, falling back to vision:', ocrErr);
          // ocrText stays undefined → vision path below
        }
      }

      // 2) Send to Gemini. Cheap text path when OCR was fruitful, expensive
      //    vision path otherwise.
      setScanStage('parsing');
      let result;
      const usableText = (ocrText || '').trim().length >= OCR_MIN_TEXT_CHARS;
      if (usableText) {
        result = await processReceiptText(ocrText, ocrLines || []);
      } else {
        // Vision path: the receipt IMAGE must leave the device. Gate on consent.
        const consent = getVisionConsent();
        if (consent !== true) {
          // Pause here and ask. The modal's Allow resumes via runVision(); a
          // decline surfaces guidance. Either way, stop the spinner meanwhile.
          setVisionPrompt({ base64, mimeType });
          setIsProcessing(false);
          setScanStage('idle');
          return;
        }
        if (ocrText !== undefined) {
          // We got SOME text but not enough — explain the slower fallback.
          showToast('OCR couldn\'t read clearly — using image fallback…', 'info', { duration: 3000 });
        }
        result = await processReceiptImage(base64, mimeType);
      }

      finalizeResult(result);
      return;
    } catch (err) {
      handleParseError(err);
    } finally {
      setIsProcessing(false);
      setScanStage('idle');
    }
  }, [showToast, finalizeResult, handleParseError]);

  // Runs the vision call after consent is granted, reusing the same
  // finalize/error tail as the main pipeline.
  const runVision = useCallback(async ({ base64, mimeType }) => {
    setIsProcessing(true);
    setScanStage('parsing');
    setScanError(null);
    try {
      const result = await processReceiptImage(base64, mimeType);
      finalizeResult(result);
    } catch (err) {
      handleParseError(err);
    } finally {
      setIsProcessing(false);
      setScanStage('idle');
    }
  }, [finalizeResult, handleParseError]);

  const onVisionAllow = useCallback(() => {
    setVisionConsent(true);
    const params = visionPrompt;
    setVisionPrompt(null);
    if (params) runVision(params);
  }, [visionPrompt, runVision]);

  const onVisionDecline = useCallback(() => {
    // "Not now" is per-scan — we do NOT remember a no, so the fallback stays
    // available next time. Keep the photo so a retry (or a clearer reshoot)
    // works, and point at manual entry as the offline-safe path.
    setVisionPrompt(null);
    setScanError({
      code: 'VISION_DECLINED',
      message: "We couldn't read that receipt on your device, and you chose not to send the photo. Try a clearer shot, or add items by hand.",
    });
  }, []);

  // Resume an in-flight scan after a page reload. StrictMode mounts effects
  // twice in dev — the ref guard makes sure we don't double-run the pipeline.
  const hasResumedRef = useRef(false);
  useEffect(() => {
    if (hasResumedRef.current) return;
    hasResumedRef.current = true;

    const pending = readPendingScan();
    if (!pending?.dataUrl) return;

    pendingRef.current = pending;
    setPreview(pending.dataUrl);

    // If we already had a parsed list when the reload happened, skip everything
    // and jump to the review screen.
    if (Array.isArray(pending.parsedItems) && pending.parsedItems.length > 0) {
      setParsedItems(pending.parsedItems);
      return;
    }

    // Otherwise run the pipeline — runPipeline handles "OCR already done"
    // internally so we don't pay for it twice when ocrText is in the blob.
    runPipeline(pending);
  }, [runPipeline]);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Allow re-selecting the same file later (onChange won't fire otherwise).
    e.target.value = '';

    // A new capture supersedes any half-finished one.
    clearPendingScan();

    let scan;
    try {
      scan = await loadAndDownscale(file);
    } catch (err) {
      console.error('Could not read image:', err);
      showToast('Couldn\'t read that image — try another photo.', 'error');
      return;
    }

    setPreview(scan.dataUrl);

    const pending = { dataUrl: scan.dataUrl, base64: scan.base64, mimeType: scan.mimeType };
    pendingRef.current = pending; // in-memory fallback for retry
    // Persist BEFORE OCR — that way a refresh during OCR can resume.
    writePendingScan(pending);
    runPipeline(pending);
  };

  const handleScanAgain = () => {
    clearPendingScan();
    setPreview(null);
    setParsedItems([]);
    setScanError(null);
  };

  // Re-run the pipeline without re-photographing. Prefer the persisted blob
  // (carries any completed OCR text, so retry skips straight to the parse);
  // fall back to the in-memory copy if persistence failed or the blob aged out.
  const handleRetry = () => {
    const pending = readPendingScan() || pendingRef.current;
    if (pending?.dataUrl) {
      runPipeline(pending);
    } else {
      showToast('That photo is no longer available — please retake it.', 'info');
      handleScanAgain();
    }
  };

  const clearScanError = () => setScanError(null);

  const toggleItem = (key) => {
    setParsedItems((prev) =>
      prev.map((item) => (item._key === key ? { ...item, _selected: !item._selected } : item))
    );
  };

  const updateItem = (key, field, value) => {
    setParsedItems((prev) =>
      prev.map((item) => (item._key === key ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirm = async () => {
    if (!activePantry || isProcessing) return; // reentrancy: double-tap = double import

    setIsProcessing(true);
    const selected = parsedItems.filter((item) => item._selected && item.name.trim());
    if (selected.length === 0) {
      showToast('No valid items selected');
      setIsProcessing(false);
      return;
    }

    // Atomic import: everything lands or nothing does (the parsed list stays
    // on screen for a clean retry). `failed` is only non-zero on the pre-
    // migration fallback path, which can still partially land.
    let result;
    try {
      result = await importReceiptItems(
        activePantry.id,
        selected.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          expirationDate: item.expirationDate || null,
        }))
      );
    } catch (err) {
      console.error('Receipt import failed:', err);
      setIsProcessing(false);
      showToast('Import failed — nothing was added. Please try again.', 'error');
      return;
    }

    setIsProcessing(false);

    if (result.added > 0) {
      setIsDone(true);
      // Import landed — discard the persisted blob so the next visit starts clean.
      clearPendingScan();
      if (result.failed > 0) {
        showToast(`${result.added} added, ${result.failed} failed — check your pantry`, 'info');
      } else {
        showToast(`${result.added} item${result.added !== 1 ? 's' : ''} added to pantry`);
      }
      setTimeout(() => navigate('/'), 1200);
    } else {
      showToast('All items failed to import — please try again', 'error');
    }
  };

  const selectedCount = parsedItems.filter((i) => i._selected && i.name.trim()).length;

  return (
    <div className="page-content app-container">
      {visionPrompt && (
        <div
          className="scan-vision-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vision-consent-title"
        >
          <div className="scan-vision-modal">
            <h3 id="vision-consent-title">Send this photo to Google to read it?</h3>
            <p>
              Your phone couldn&rsquo;t read this receipt. We can send the photo to
              Google&rsquo;s text-reader to pull the items out. It&rsquo;s used only
              to read this receipt, it isn&rsquo;t stored by us, and it&rsquo;s never
              sold. Readable receipts never leave your device.
            </p>
            <div className="scan-vision-actions">
              <button className="btn btn-secondary" onClick={onVisionDecline}>
                Not now
              </button>
              <button className="btn btn-primary" onClick={onVisionAllow}>
                Send and read it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="scan-page animate-fade-in">
        {/* Header */}
        <div className="scan-header">
          <button className="scan-back" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h2 className="page-title">Scan Receipt</h2>
          <p className="page-subtitle">Capture or upload a receipt to auto-import items</p>
        </div>

        {scanError && (
          <div className="scan-error-banner animate-fade-in">
            <p>{scanError.message}</p>
            {(scanError.code === 'NO_API_KEY' || scanError.code === 'GEMINI_BAD_KEY') ? (
              // Photo stays persisted — after fixing the key in Settings,
              // returning here resumes the scan automatically.
              <Link to="/settings" className="btn btn-secondary" onClick={clearScanError}>
                Open Settings
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={handleRetry} disabled={isProcessing}>
                Try again
              </button>
            )}
            {preview && !isProcessing && (
              <button type="button" className="btn btn-secondary" onClick={handleScanAgain}>
                Start over
              </button>
            )}
          </div>
        )}

        {/* Capture Zone */}
        {!preview && (
          <div className="scan-capture-zone" onClick={() => uploadInputRef.current?.click()}>
            <div className="scan-capture-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p className="scan-capture-text">Snap or upload a receipt</p>
            <p className="scan-capture-hint">Take a photo now, or pick one from your library</p>
            <div className="scan-capture-buttons">
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
              >
                Take photo
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  uploadInputRef.current?.click();
                }}
              >
                Upload
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="scan-file-input"
              onChange={handleCapture}
            />
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="scan-file-input"
              onChange={handleCapture}
            />
          </div>
        )}

        {/* Preview + Processing */}
        {preview && !parsedItems.length && (
          <div className="scan-preview">
            <img src={preview} alt="Receipt preview" className="scan-preview-img" />
            {isProcessing && (
              <div className="scan-processing">
                <div className="scan-spinner" />
                {scanStage === 'ocr' ? (
                  <>
                    <p>Reading receipt… {ocrProgress}%</p>
                    <div className="scan-progress-track">
                      <div
                        className="scan-progress-fill"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </>
                ) : scanStage === 'parsing' ? (
                  <p>Extracting items…</p>
                ) : (
                  <p>Scanning receipt…</p>
                )}
                <p className="scan-processing-hint">
                  If you switch tabs we'll pick up where we left off.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Parsed Items */}
        {parsedItems.length > 0 && !isDone && (
          <div className="scan-results animate-fade-in">
            <div className="scan-results-header">
              <h3>{parsedItems.length} items found</h3>
              <span className="scan-results-selected">{selectedCount} selected</span>
            </div>

            <div className="scan-items-list">
              {parsedItems.map((item) => (
                <div key={item._key} className={`scan-item ${item._selected ? '' : 'deselected'}`}>
                  <button
                    className={`scan-item-check ${item._selected ? 'checked' : ''}`}
                    onClick={() => toggleItem(item._key)}
                    aria-label={item._selected ? 'Deselect' : 'Select'}
                  >
                    {item._selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div className="scan-item-details">
                    <input
                      className="scan-item-name"
                      value={item.name}
                      onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                    />
                    <div className="scan-item-meta">
                      <input
                        type="number"
                        className="scan-item-qty"
                        min="0.5"
                        step="0.5"
                        value={item.quantity}
                        onChange={(e) => updateItem(item._key, 'quantity', parseFloat(e.target.value) || 1)}
                      />
                      <select
                        className="scan-item-unit"
                        value={item.unit}
                        onChange={(e) => updateItem(item._key, 'unit', e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <select
                        className="scan-item-category"
                        value={item.category}
                        onChange={(e) => updateItem(item._key, 'category', e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="scan-item-meta" style={{ marginTop: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginRight: '6px' }}>Exp:</label>
                      <input
                        type="date"
                        className="scan-item-exp"
                        value={item.expirationDate || ''}
                        onChange={(e) => updateItem(item._key, 'expirationDate', e.target.value)}
                        style={{ flex: 1, padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="scan-actions">
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleConfirm}
                disabled={selectedCount === 0 || isProcessing}
              >
                {isProcessing ? 'Adding…' : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''} to Pantry`}
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleScanAgain} disabled={isProcessing}>
                Scan Again
              </button>
            </div>
          </div>
        )}

        {/* Success */}
        {isDone && (
          <div className="scan-success animate-fade-in">
            <div className="scan-success-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Items Added</h3>
            <p>Redirecting to your pantry...</p>
          </div>
        )}
      </div>
    </div>
  );
}
