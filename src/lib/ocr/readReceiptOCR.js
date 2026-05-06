// Tesseract.js-powered receipt OCR. Runs entirely in the browser, no server cost.
//
// Tesseract is dynamic-imported here so the ~2MB JS bundle (and the ~5MB English
// language data it lazy-fetches from CDN) only loads when the user actually
// scans something. First scan is slow; subsequent scans reuse the cached worker
// and language data.
//
// Output shape matches the OCR implementation guide so the downstream model
// can decide what's an item, what's metadata, and what to ignore.

import { preprocessReceiptImage } from './preprocessReceiptImage';

/**
 * @param {Blob|File} file  the captured receipt image
 * @param {(percent: number) => void} onProgress  0-100 during the recognize phase
 * @returns {Promise<{ rawText: string, lines: string[], confidence: number }>}
 */
export async function readReceiptOCR(file, onProgress) {
  // Lazy-load Tesseract so the page doesn't pay for it on cold open.
  const { createWorker, PSM } = await import('tesseract.js');

  const processedImage = await preprocessReceiptImage(file);

  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(Math.round((message.progress || 0) * 100));
      }
    },
  });

  try {
    // Receipts are usually one tall block of text — SINGLE_BLOCK beats AUTO
    // on the formats we care about (Trader Joe's, Whole Foods, Target, etc.).
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    const result = await worker.recognize(processedImage);
    const rawText = result.data.text || '';

    return {
      rawText,
      lines: cleanOCRLines(rawText),
      confidence: result.data.confidence ?? 0,
    };
  } finally {
    // Release worker memory. If we ever support multiple scans per session
    // we should pool the worker instead, but the wins are marginal for now.
    await worker.terminate();
  }
}

function cleanOCRLines(rawText) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
