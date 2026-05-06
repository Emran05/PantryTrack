import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { addPantryItem, processReceiptText, processReceiptImage } from '../lib/supabaseStorage';
import { usePantry } from '../contexts/PantryContext';
import { CATEGORIES, UNITS, getDefaultExpirationDate } from '../lib/helpers';
import { useToast } from '../components/ToastContext';
import { readReceiptOCR } from '../lib/ocr/readReceiptOCR';
import { readPendingScan, writePendingScan, clearPendingScan, dataUrlToBlob } from '../lib/scanPersistence';
import './ScanReceipt.css';

// If OCR produces fewer than this many characters of usable text, we treat it
// as "OCR couldn't read the receipt" and try Gemini Vision on the original image.
const OCR_MIN_TEXT_CHARS = 40;

export default function ScanReceipt() {
  const navigate = useNavigate();
  const { activePantry } = usePantry();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  // 'idle' | 'ocr' | 'parsing' — drives the in-progress copy
  const [scanStage, setScanStage] = useState('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  // null | { code, message, resetLabel? }
  const [scanError, setScanError] = useState(null);
  const { showToast } = useToast();

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
        if (ocrText !== undefined) {
          // We got SOME text but not enough — explain the slower fallback.
          showToast('OCR couldn\'t read clearly — using image fallback…', 'info', { duration: 3000 });
        }
        result = await processReceiptImage(base64, mimeType);
      }

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
      setParsedItems(enriched);
      // Persist the parsed list — now a refresh would resume straight to review.
      writePendingScan({ parsedItems: enriched });
    } catch (err) {
      console.error('Receipt parse failed:', err);
      const banneredCodes = ['NO_API_KEY', 'GEMINI_BAD_KEY', 'RATE_LIMITED', 'GEMINI_RATE_LIMIT'];
      if (banneredCodes.includes(err.code)) {
        let message = err.message;
        if (err.code === 'GEMINI_RATE_LIMIT') {
          const wait = err.retryDelaySeconds
            ? `try again in ${err.retryDelaySeconds}s`
            : 'try again in a moment';
          message = `Google throttled the request — ${wait}. Add your own key in Settings for more headroom.`;
        }
        setScanError({ code: err.code, message, resetLabel: err.resetLabel });
      } else {
        showToast('Failed to parse receipt. Please try again.');
      }
      setPreview(null);
      clearPendingScan();
    } finally {
      setIsProcessing(false);
      setScanStage('idle');
    }
  }, [showToast]);

  // Resume an in-flight scan after a page reload. StrictMode mounts effects
  // twice in dev — the ref guard makes sure we don't double-run the pipeline.
  const hasResumedRef = useRef(false);
  useEffect(() => {
    if (hasResumedRef.current) return;
    hasResumedRef.current = true;

    const pending = readPendingScan();
    if (!pending?.dataUrl) return;

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

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // A new capture supersedes any half-finished one.
    clearPendingScan();

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
      const imageBase64 = dataUrl.substring(dataUrl.indexOf(',') + 1);

      setPreview(dataUrl);

      const pending = { dataUrl, base64: imageBase64, mimeType };
      // Persist BEFORE OCR — that way a refresh during OCR can resume.
      writePendingScan(pending);
      runPipeline(pending);
    };
    reader.readAsDataURL(file);
  };

  const handleScanAgain = () => {
    clearPendingScan();
    setPreview(null);
    setParsedItems([]);
    setScanError(null);
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
    if (!activePantry) return;

    setIsProcessing(true);
    const selected = parsedItems.filter((item) => item._selected && item.name.trim());
    if (selected.length === 0) {
      showToast('No valid items selected');
      setIsProcessing(false);
      return;
    }

    const results = await Promise.allSettled(
      selected.map((item) =>
        addPantryItem(activePantry.id, {
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          expirationDate: item.expirationDate || null,
        }, { skipDuplicateCheck: true })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    setIsProcessing(false);

    if (succeeded > 0) {
      setIsDone(true);
      // Import landed — discard the persisted blob so the next visit starts clean.
      clearPendingScan();
      if (failed > 0) {
        showToast(`${succeeded} added, ${failed} failed — check your pantry`);
      } else {
        showToast(`${succeeded} item${succeeded !== 1 ? 's' : ''} added to pantry`);
      }
      setTimeout(() => navigate('/'), 1200);
    } else {
      showToast('All items failed to import — please try again');
    }
  };

  const selectedCount = parsedItems.filter((i) => i._selected && i.name.trim()).length;

  return (
    <div className="page-content app-container">
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
              <Link to="/settings" className="btn btn-secondary" onClick={clearScanError}>
                Open Settings
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={clearScanError}>
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Capture Zone */}
        {!preview && (
          <div className="scan-capture-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="scan-capture-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p className="scan-capture-text">Tap to capture or upload receipt</p>
            <p className="scan-capture-hint">Supports camera and photo library</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 1)}
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
                disabled={selectedCount === 0}
              >
                Add {selectedCount} item{selectedCount !== 1 ? 's' : ''} to Pantry
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleScanAgain}>
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
