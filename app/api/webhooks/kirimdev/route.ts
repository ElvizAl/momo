import { setTimeout as delay } from "node:timers/promises";
import { after } from "next/server";
import { verifyWebhookSignature } from "@kirimdev/sdk/webhooks";
import { z } from "zod";

import { generateReply } from "@/app/lib/agent";
import { sendWhatsAppText, showWhatsAppTyping } from "@/app/lib/kirimdev";

export const runtime = "nodejs";
export const maxDuration = 300;

const payloadSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({
              phone_number_id: z.string(),
            }),
            messages: z.array(
              z.object({
                id: z.string(),
                from: z.string().optional(),
                type: z.string(),
                text: z.object({
                  body: z.string(),
                }).optional(),
              }),
            ).optional(),
          }),
        }),
      ),
    }),
  ),
});

// Pencegahan duplikat sementara untuk satu proses demo lokal.
// Data ini hilang saat server restart.
const processed = new Map<string, number>();
const ttl = 24 * 60 * 60 * 1000;

export async function GET() {
  return Response.json({ status: "Webhook aktif" });
}

export async function POST(request: Request) {
  const secret = process.env.KIRIMDEV_WEBHOOK_SECRET;
  const phoneId = process.env.KIRIMDEV_PHONE_NUMBER_ID;

  if (!secret || !phoneId) {
    return Response.json(
      { error: "Konfigurasi webhook belum lengkap" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  let payload: unknown;

  try {
    payload = await verifyWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get("x-kirim-signature"),
      secrets: [secret],
    });
  } catch {
    return Response.json(
      { error: "Webhook tidak valid" },
      { status: 401 },
    );
  }

  if (request.headers.get("x-kirim-event") !== "message.received") {
    return Response.json({ ok: true });
  }

  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: "Format payload tidak sesuai" },
      { status: 400 },
    );
  }

  const now = Date.now();

  for (const [key, expiresAt] of processed) {
    if (expiresAt <= now) processed.delete(key);
  }

  const jobs: Array<{
    key: string;
    messageId: string;
    from: string;
    text: string;
  }> = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Subscription bisa menerima event dari beberapa nomor bisnis.
      if (value.metadata.phone_number_id !== phoneId) continue;

      for (const message of value.messages ?? []) {
        if (
          message.type !== "text" ||
          !message.from ||
          !message.text?.body.trim()
        ) {
          continue;
        }

        const key = `${phoneId}:${message.id}`;

        if (processed.has(key)) continue;

        processed.set(key, now + ttl);

        jobs.push({
          key,
          messageId: message.id,
          from: message.from,
          text: message.text.body,
        });
      }
    }
  }

  // Kirim HTTP 200 dulu, lalu proses AI di proses Next.js.
  after(async () => {
    for (const job of jobs) {
      try {
        const reply = await generateReply(job.text);
        // Indikator typing kedaluwarsa sekitar 25 detik; tampilkan di akhir jeda.
        await delay(40_000);
        try {
          await showWhatsAppTyping(job.messageId);
        } catch (error) {
          // Kegagalan indikator tidak boleh menggagalkan pengiriman balasan.
          console.warn(
            "Gagal menampilkan indikator mengetik:",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
        await delay(20_000);
        await sendWhatsAppText(job.from, reply);

        console.info("Pesan berhasil dibalas.");
      } catch (error) {
        processed.delete(job.key);

        console.error(
          "Gagal memproses pesan:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  });

  return Response.json({ ok: true });
}
