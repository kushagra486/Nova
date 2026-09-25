/**
 * Level 2 "specialized tool" execution: local PDF text extraction, no LLM
 * involved. Runs entirely in-process via pdf-parse (built on pdf.js) — the
 * file's bytes never leave the server, let alone reach an AI provider.
 */
import { PDFParse } from "pdf-parse";

// Vercel serverless functions cap request bodies around 4.5MB; base64 inflates
// size by ~33%, so keep the decoded PDF well under that after JSON overhead.
const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3MB decoded

export interface PdfExtractResult {
  text: string;
  numPages: number;
}

export function decodePdfBase64(base64: string): Buffer {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("Empty or invalid file data.");
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`File is ${(buffer.length / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_PDF_BYTES / 1024 / 1024}MB.`);
  }
  return buffer;
}

export async function extractPdfText(base64: string): Promise<PdfExtractResult> {
  const buffer = decodePdfBase64(base64);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text.trim(), numPages: result.total };
  } finally {
    await parser.destroy();
  }
}

export function formatPdfExtractionOutput(result: PdfExtractResult): string {
  if (!result.text) {
    return `No extractable text found across ${result.numPages} page(s) — this PDF may be a scanned image without a text layer.`;
  }
  return result.text;
}
