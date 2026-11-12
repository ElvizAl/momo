import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { sendWhatsAppText, showWhatsAppTyping } from "./kirimdev";

const originalFetch = globalThis.fetch;
const originalKey = process.env.KIRIMDEV_API_KEY;
const originalPhoneId = process.env.KIRIMDEV_PHONE_NUMBER_ID;
const requests: Array<{ url: string; payload: unknown }> = [];

beforeEach(() => {
  requests.length = 0;
  process.env.KIRIMDEV_API_KEY = "synthetic-test-key";
  process.env.KIRIMDEV_PHONE_NUMBER_ID = "test-account";
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), payload: JSON.parse(String(init?.body)) });
    return Response.json({ ok: true });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.KIRIMDEV_API_KEY;
  else process.env.KIRIMDEV_API_KEY = originalKey;
  if (originalPhoneId === undefined) delete process.env.KIRIMDEV_PHONE_NUMBER_ID;
  else process.env.KIRIMDEV_PHONE_NUMBER_ID = originalPhoneId;
});

test("typing uses the inbound wamid with a read receipt", async () => {
  await showWhatsAppTyping("wamid.inbound-test");
  assert.deepEqual(requests, [{
    url: "https://api.kirimdev.com/v1/test-account/messages",
    payload: {
      messaging_product: "whatsapp", status: "read",
      message_id: "wamid.inbound-test", typing_indicator: { type: "text" },
    },
  }]);
});

test("text sending keeps its outbound payload", async () => {
  await sendWhatsAppText("test-recipient", "Halo");
  assert.deepEqual(requests[0].payload, {
    messaging_product: "whatsapp", to: "test-recipient",
    type: "text", text: { body: "Halo" },
  });
});
