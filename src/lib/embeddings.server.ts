// Embeddings via Hugging Face Inference API.
// Using the popular and fast all-MiniLM-L6-v2 model.

export async function embed(text: string): Promise<number[]> {
  const key = process.env.HF_API_KEY;
  if (!key) throw new Error("Missing HF_API_KEY. Please add it to your .env file.");
  
  const res = await fetch("https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hugging Face API failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  
  // The API might return a 1D array or a 2D array depending on batching
  if (Array.isArray(json) && Array.isArray(json[0])) {
    return json[0];
  }
  return json as number[];
}


