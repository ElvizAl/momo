import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { POST } from "./route";

const secret = "whsec_synthetic_test_only";
const originalSecret = process.env.KIRIM_WEBHOOK_SECRET;
after(() => {
  if (originalSecret === undefined) delete process.env.KIRIM_WEBHOOK_SECRET;
  else process.env.KIRIM_WEBHOOK_SECRET = originalSecret;
});

function request(body: string, event = "message.received", age = 0) {
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Request("https://example.test/api/webhooks/kirimdev", {
    method: "POST",
    body,
    headers: {
      "x-kirim-event": event,
      "x-kirim-signature": `t=${timestamp},v1=${signature}`,
    },
  });
}


process.env.KIRIM_WEBHOOK_SECRET = secret;

test("returns the first message like the kempong reference", async () => {
  const value = {
    metadata: { phone_number_id: "test-account" },
    messages: [
      { id: "test-text", from: "test-sender", type: "text", text: { body: "Halo" } },
      { id: "test-image", from: "test-sender", type: "image" },
    ],
  };
  const response = await POST(request(JSON.stringify({
    entry: [{ changes: [{ value }, { value }] }, { changes: [{ value }] }],
  })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    message: {
      messageId: "test-text",
      phoneNumberId: "test-account",
      customerNumber: "test-sender",
      type: "text",
      text: "Halo",
    },
  });
});

test("ignores other signed events", async () => {
  const response = await POST(request('{"data":{}}', "contact.created"));
  assert.deepEqual(await response.json(), { ok: true, ignored: true });
});

test("accepts empty message batches", async () => {
  const response = await POST(request('{"entry":[]}'));
  assert.deepEqual(await response.json(), { ok: true, ignored: true });
});

test("rejects a missing signature", async () => {
  const response = await POST(new Request("https://example.test", { method: "POST", body: "{}" }));
  assert.equal(response.status, 401);
});

test("rejects a changed body even for ignored events", async () => {
  const signed = request("{}", "message.status");
  const response = await POST(new Request(signed.url, {
    method: "POST", headers: signed.headers, body: '{"tampered":true}',
  }));
  assert.equal(response.status, 401);
});

test("rejects expired signatures", async () => {
  assert.equal((await POST(request("{}", "message.received", 600))).status, 400);
});

test("rejects signed malformed JSON", async () => {
  assert.equal((await POST(request("{"))).status, 400);
});

test("reads status batches across entries and changes with failure details", async () => {
  const error = { code: 131026, title: "Message undeliverable" };
  const value = {
    metadata: { phone_number_id: "test-account" },
    statuses: [
      { id: "wamid-test", recipient_id: "test-recipient", status: "read", timestamp: "123" },
      { id: "wamid-failed", recipient_id: "test-recipient", status: "failed", errors: [error] },
    ],
  };
  const response = await POST(request(JSON.stringify({
    entry: [{ changes: [{ value }, { value }] }, { changes: [{ value }] }],
  }), "message.status"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ignored, false);
  assert.equal(body.statuses.length, 6);
  assert.deepEqual(body.statuses[0], {
    messageId: "wamid-test", phoneNumberId: "test-account",
    customerNumber: "test-recipient", status: "read", timestamp: "123", errors: [],
  });
  assert.deepEqual(body.statuses[1].errors, [error]);
});

test("reads the KirimDev outbound envelope rather than Meta entries", async () => {
  const response = await POST(request(JSON.stringify({
    id: "event-sent", type: "message.sent",
    data: {
      session: "test-account", timestamp: "2026-11-11T00:00:00Z",
      message: { id: "msg-test", provider_id: "wamid-test", type: "text",
        body: "Balasan", to: "test-recipient", status: "sent", source: "api" },
    },
  }), "message.sent"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true, message: { eventId: "event-sent", messageId: "msg-test",
      providerMessageId: "wamid-test", phoneNumberId: "test-account",
      customerNumber: "test-recipient", type: "text", text: "Balasan",
      status: "sent", source: "api", timestamp: "2026-11-11T00:00:00Z" },
  });
});

test("ignores empty status and outbound payloads", async () => {
  const status = await POST(request('{"entry":[]}', "message.status"));
  assert.deepEqual(await status.json(), { ok: true, statuses: [], ignored: true });
  const sent = await POST(request('{"data":{}}', "message.sent"));
  assert.deepEqual(await sent.json(), { ok: true, ignored: true });
});

test("rejects forged signatures on every supported event", async () => {
  for (const event of ["message.received", "message.status", "message.sent"]) {
    const signed = request("{}", event);
    const response = await POST(new Request(signed.url, {
      method: "POST", headers: signed.headers, body: '{"changed":true}',
    }));
    assert.equal(response.status, 401);
  }
});

