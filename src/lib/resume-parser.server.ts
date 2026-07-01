// Resume text extraction for PDF, DOCX, TXT. Runs server-side.
// PDF: pdfjs-dist legacy build (Worker-compatible pure JS).
// DOCX: mammoth.
// Images: caller should route to geminiOcr instead.

export async function extractResumeText(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return new TextDecoder().decode(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer as ArrayBuffer });
    return result.value;
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    // pdfjs-dist legacy build works in Workers with no DOM canvas.
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Disable worker: run pdf.js on the main thread.
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "";
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => ("str" in it ? it.str : "")).filter(Boolean);
      text += strings.join(" ") + "\n\n";
    }
    return text.trim();
  }

  throw new Error(`Unsupported file type: ${mimeType || fileName}`);
}
