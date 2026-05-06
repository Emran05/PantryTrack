// Browser-side image preprocessing for receipt OCR.
// Goals (per the OCR implementation guide):
//   - resize down so massive phone photos don't crawl through Tesseract
//   - grayscale + binarise so faint print becomes legible
//   - turn near-white pixels white, near-black black (high-contrast threshold)
//
// Returns a PNG Blob that Tesseract reads more reliably than the raw photo.

const MAX_WIDTH = 1400;
const BINARISE_THRESHOLD = 145; // 0..255 — works well for thermal receipts

export async function preprocessReceiptImage(file) {
  const image = await loadImage(file);

  const scale = image.width > MAX_WIDTH ? MAX_WIDTH / image.width : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Luminance, then hard threshold to black/white
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const gray = lum > BINARISE_THRESHOLD ? 255 : 0;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // alpha stays as-is
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
