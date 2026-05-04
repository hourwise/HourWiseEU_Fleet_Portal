/**
 * OCR Service using OCR.space Free Tier
 * Limits: 1MB per file, 25k requests per month
 */

const OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY;
const OCR_SPACE_API_URL = 'https://api.ocr.space/parse/image';

export interface OCRResult {
  text: string;
  data: {
    expiryDate?: string;
    idNumber?: string;
    documentType?: string;
  };
}

/**
 * Extracts potential dates from text and returns the most likely expiry date in YYYY-MM-DD format
 */
function extractExpiryDate(text: string): string | undefined {
  // Look for dates in formats like DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b|\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g;
  const matches = Array.from(text.matchAll(dateRegex));

  if (matches.length === 0) return undefined;

  // Take the last date found (often expiry is at the bottom)
  const lastMatch = matches[matches.length - 1];

  let day, month, year;
  if (lastMatch[1]) {
    // DD/MM/YYYY
    day = lastMatch[1].padStart(2, '0');
    month = lastMatch[2].padStart(2, '0');
    year = lastMatch[3];
  } else {
    // YYYY/MM/DD
    year = lastMatch[4];
    month = lastMatch[5].padStart(2, '0');
    day = lastMatch[6].padStart(2, '0');
  }

  return `${year}-${month}-${day}`;
}

/**
 * Extracts potential ID numbers (generic pattern for now)
 */
function extractIDNumber(text: string): string | undefined {
  // Look for patterns common in licences (e.g., alphanumeric strings of 5-20 chars)
  // This is highly variable, so we'll look for labels first
  const idLabels = /licence\s*no|license\s*no|id\s*number|document\s*no/gi;
  const labelIndex = text.search(idLabels);

  if (labelIndex !== -1) {
    const context = text.substring(labelIndex, labelIndex + 50);
    const idMatch = context.match(/[A-Z0-9]{5,20}/);
    if (idMatch) return idMatch[0];
  }

  return undefined;
}

export async function scanDocument(file: File): Promise<OCRResult> {
  if (!OCR_SPACE_API_KEY) {
    throw new Error('OCR.space API key is not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('apikey', OCR_SPACE_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');

  try {
    const response = await fetch(OCR_SPACE_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR API responded with status ${response.status}`);
    }

    const result = await response.json();

    if (result.IsErroredOnProcessing) {
      throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
    }

    const fullText = result.ParsedResults?.[0]?.ParsedText || '';

    return {
      text: fullText,
      data: {
        expiryDate: extractExpiryDate(fullText),
        idNumber: extractIDNumber(fullText),
      },
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}
