async function postWhatsAppMessage(payload: Record<string, unknown>) {
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
        ...payload,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error(`KirimDev gagal mengirim: HTTP ${response.status}`);
  }
}

export async function sendWhatsAppText(to: string, text: string) {
  await postWhatsAppMessage({ to, type: "text", text: { body: text } });
}

export async function showWhatsAppTyping(messageId: string) {
  // Gunakan wamid pesan masuk, bukan ID pesan internal KirimDev.
  await postWhatsAppMessage({
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });
}
