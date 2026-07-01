import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenerativeAI(key);
}

// Extract text from an image using Gemini Vision (OCR).
export async function geminiOcr(base64Image: string, mimeType: string): Promise<string> {
  const gemini = getGemini();
  const model = gemini.getGenerativeModel({ model: "gemini-flash-latest" });
  
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
        "Extract all the text from this resume. Do not summarize, just output the raw text faithfully.",
      ]);
      return res.response.text();
    } catch (e: any) {
      lastError = e;
      if (e.message && e.message.includes("503") && attempt < 3) {
        console.warn(`Gemini OCR 503 error on attempt ${attempt}. Retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
