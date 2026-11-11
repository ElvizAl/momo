export async function sendWhatsAppText(to: string, text: string) {
  const apiKey = process.env.KIRIMDEV_API_KEY;
  const phoneId = process.env.KIRIMDEV_PHONE_NUMBER_ID;

  if (!apiKey || !phoneId) {
    throw new Error("Konfigurasi KirimDev belum lengkap.");
  }

  const response = await fetch(
    `https://api.kirimdev.com/v1/${encodeURIComponent(phoneId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error(`KirimDev gagal mengirim: HTTP ${response.status}`);
  }
}