import { Agent } from "@anvia/core";
import { OpenAIClient } from "@anvia/openai";

export async function generateReply(message: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelId = process.env.OPENAI_MODEL;
  const baseUrl = process.env.OPENAI_BASE_URL;

  if (!apiKey || !modelId || !baseUrl) {
    throw new Error("OPENAI_API_KEY, OPENAI_MODEL, atau OPENAI_BASE_URL belum diisi.");
  }

  const model = new OpenAIClient({ apiKey, baseUrl }).completionModel({
    modelId,
    api: "chat",
  });

  const agent = new Agent({
    id: "wa-frozenfood",
    model,
    instructions: `
      Kamu adalah customer service toko frozen food.
      Jawab dalam bahasa Indonesia, ramah, dan ringkas.
      Batasi jawaban maksimal 1000 karakter.
      Jangan mengarang harga, stok, ongkir, atau status pesanan.
      Jika data belum tersedia, sampaikan perlu konfirmasi admin.
      Jangan menyatakan pesanan sudah dibuat atau pembayaran diterima.
    `,
  });

  const result = await agent.generate({ prompt: message });

  if (result.type !== "response" || !result.text.trim()) {
    return "Maaf, saya belum bisa menjawab. Silakan hubungi admin.";
  }

  return result.text.slice(0, 4000);
}