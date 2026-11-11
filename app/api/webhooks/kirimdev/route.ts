import {
  InvalidSignatureError,
  MalformedPayloadError,
  SignatureExpiredError,
  verifyWebhookSignature,
  type MessageSentEvent,
} from "@kirimdev/sdk/webhooks";

export const runtime = "nodejs";

type WebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
        statuses?: Array<{
          id?: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{
            code?: number;
            title?: string;
            message?: string;
            error_data?: { details?: string };
          }>;
        }>;
      };
    }>;
  }>;
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-kirim-signature");
  const eventName = request.headers.get("x-kirim-event");

  try {
    const payload = await verifyWebhookSignature({
      rawBody,
      signatureHeader: signature,
      secrets: [process.env.KIRIM_WEBHOOK_SECRET!],
      toleranceSeconds: 300,
    });

    if (eventName === "message.sent") {
      // Event keluar memakai envelope KirimDev, berbeda dari payload Meta.
      const body = payload as MessageSentEvent;
      const data = body.data;
      const message = data?.message;

      if (!message) {
        return Response.json({ ok: true, ignored: true });
      }

      const result = {
        eventId: body.id,
        messageId: message.id,
        providerMessageId: message.provider_id,
        phoneNumberId: data.meta?.phone_number_id ?? data.session,
        customerNumber: message.to ?? data.contact?.phone_number,
        type: message.type,
        text: message.body ?? null,
        status: message.status,
        source: message.source,
        timestamp: data.timestamp,
      };

      console.log("Pesan WhatsApp keluar:", result);
      return Response.json({ ok: true, message: result });
    }

    if (eventName === "message.status") {
      const body = payload as WebhookBody;
      const statuses = (body.entry ?? []).flatMap((entry) =>
        (entry.changes ?? []).flatMap(({ value }) =>
          (value?.statuses ?? []).map((status) => ({
            messageId: status.id,
            phoneNumberId: value?.metadata?.phone_number_id,
            customerNumber: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            errors: status.errors ?? [],
          })),
        ),
      );

      for (const status of statuses) {
        console.log("Status pesan WhatsApp:", status);
      }
      return Response.json({ ok: true, statuses, ignored: statuses.length === 0 });
    }

    // Abaikan event lain setelah signature diverifikasi.
    if (eventName !== "message.received") {
      return Response.json({
        ok: true,
        ignored: true,
      });
    }

    const body = payload as WebhookBody;
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return Response.json({
        ok: true,
        ignored: true,
      });
    }

    const result = {
      messageId: message.id,
      phoneNumberId: value?.metadata?.phone_number_id,
      customerNumber: message.from,
      type: message.type,
      text: message.text?.body ?? null,
    };

    console.log("Pesan WhatsApp masuk:", result);

    return Response.json({
      ok: true,
      message: result,
    });
  } catch (error) {
    if (error instanceof SignatureExpiredError) {
      return new Response("Signature kedaluwarsa", {
        status: 400,
      });
    }

    if (error instanceof InvalidSignatureError) {
      return new Response("Signature tidak valid", {
        status: 401,
      });
    }

    if (error instanceof MalformedPayloadError) {
      return new Response("Payload tidak valid", {
        status: 400,
      });
    }

    console.error("Webhook error:", error);

    return new Response("Internal server error", {
      status: 500,
    });
  }
}
