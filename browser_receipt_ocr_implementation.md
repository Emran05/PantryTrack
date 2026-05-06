# Browser Receipt OCR Implementation Guide

This guide focuses only on running OCR in the browser and reading receipts. The output should be raw receipt text and cleaned receipt lines that can be passed into your model.

## OCR Flow

```txt
receipt image
→ clean image in canvas
→ send cleaned image to Tesseract.js
→ get raw text
→ split into readable receipt lines
→ pass lines/raw text to your model
```

Tesseract.js runs in the browser using a worker. The basic flow is:

```txt
create worker
recognize image
return text
terminate worker
```

If users are scanning multiple receipts in one session, reuse the worker instead of creating a new one every scan.

## 1. Install Tesseract.js

```bash
npm install tesseract.js
```

## 2. File Input for Receipt Image

Use this in your frontend:

```jsx
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleReceiptUpload}
/>
```

`capture="environment"` helps mobile browsers open the back camera.

## 3. Preprocess the Image in the Browser

Receipt OCR works much better if the image is cleaned before being sent to Tesseract.

Preprocessing goals:

```txt
resize larger
grayscale
increase contrast
turn near-white pixels white
turn dark pixels black
```

Create this file:

```js
// src/lib/ocr/preprocessReceiptImage.js

export async function preprocessReceiptImage(file) {
  const image = await loadImage(file);

  const maxWidth = 1400;
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Increase contrast
    gray = gray > 145 ? 255 : 0;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve(blob);
    }, "image/png");
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;

    img.src = URL.createObjectURL(file);
  });
}
```

This returns a cleaned PNG blob that Tesseract can read better.

## 4. Run OCR in the Browser

Create this file:

```js
// src/lib/ocr/readReceiptOCR.js

import { createWorker, PSM } from "tesseract.js";
import { preprocessReceiptImage } from "./preprocessReceiptImage";

export async function readReceiptOCR(file, onProgress) {
  const processedImage = await preprocessReceiptImage(file);

  const worker = await createWorker("eng", 1, {
    logger: message => {
      if (message.status === "recognizing text" && onProgress) {
        onProgress(Math.round(message.progress * 100));
      }
    }
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK
    });

    const result = await worker.recognize(processedImage);

    const rawText = result.data.text;

    return {
      rawText,
      lines: cleanOCRLines(rawText),
      confidence: result.data.confidence
    };
  } finally {
    await worker.terminate();
  }
}

function cleanOCRLines(rawText) {
  return rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
}
```

For receipts, `PSM.SINGLE_BLOCK` is a good first setting because receipts are usually one tall block of text.

## 5. React Component to Test It

```jsx
// src/components/ReceiptOCRTester.jsx

import { useState } from "react";
import { readReceiptOCR } from "../lib/ocr/readReceiptOCR";

export default function ReceiptOCRTester() {
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [lines, setLines] = useState([]);
  const [isReading, setIsReading] = useState(false);

  async function handleReceiptUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsReading(true);
    setProgress(0);
    setRawText("");
    setLines([]);

    try {
      const result = await readReceiptOCR(file, setProgress);

      setRawText(result.rawText);
      setLines(result.lines);

      console.log("OCR result:", result);
    } catch (error) {
      console.error(error);
      alert("Could not read receipt. Try a clearer picture.");
    } finally {
      setIsReading(false);
    }
  }

  return (
    <div>
      <h2>Receipt OCR Test</h2>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleReceiptUpload}
      />

      {isReading && <p>Reading receipt... {progress}%</p>}

      {lines.length > 0 && (
        <div>
          <h3>Detected Lines</h3>

          <ol>
            {lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      {rawText && (
        <div>
          <h3>Raw OCR Text</h3>
          <pre>{rawText}</pre>
        </div>
      )}
    </div>
  );
}
```

## 6. What Your Model Should Receive

Do not over-process the OCR before your model sees it. Give it both the full text and cleaned lines.

Example:

```js
{
  rawText: `
    TRADER JOE'S
    BANANAS 1.99
    WHOLE MILK 4.29
    CHICKEN BRST 8.42
    SUBTOTAL 14.70
    TAX 0.00
    TOTAL 14.70
  `,
  lines: [
    "TRADER JOE'S",
    "BANANAS 1.99",
    "WHOLE MILK 4.29",
    "CHICKEN BRST 8.42",
    "SUBTOTAL 14.70",
    "TAX 0.00",
    "TOTAL 14.70"
  ]
}
```

Your model can decide what is an item, what is a price, what is metadata, and what should be ignored.

## 7. Receipt Photo Rules for Better OCR

Tell users to take receipt photos like this:

```txt
Good lighting
Receipt flat on table
No shadows
No glare
Text fills most of the screen
Picture taken straight above
Avoid crumpled or curved receipts
```

Receipt OCR quality depends heavily on the input. A bad receipt photo will produce bad text no matter how good the code is.

## 8. OCR Settings to Test

Start with:

```js
tessedit_pageseg_mode: PSM.SINGLE_BLOCK
```

Then test:

```js
tessedit_pageseg_mode: PSM.AUTO
```

For a basic receipt app, expose this as an internal constant:

```js
const RECEIPT_PSM_MODE = PSM.SINGLE_BLOCK;
```

Then switch it during testing and compare results from real grocery receipts.

## 9. Final Browser OCR Function

Your production OCR layer can stay simple:

```js
async function scanReceipt(file) {
  const result = await readReceiptOCR(file);

  return {
    rawText: result.rawText,
    lines: result.lines
  };
}
```

That is all your OCR layer should do. It reads the receipt and returns text. Your model handles item extraction after that.

## 10. Practical Notes

Browser OCR is cheap because there is no OCR server cost. The tradeoff is that OCR runs on the user's device, so it may be slower on phones.

For the first version, focus on:

```txt
upload image
preprocess image
run OCR
return raw text and lines
show output for debugging
```

Once this is reliable, connect the OCR output to your model.
