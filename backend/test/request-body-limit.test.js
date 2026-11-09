import assert from "node:assert/strict";
import test from "node:test";
import { requestWithBodyLimit } from "../src/request-body-limit.js";

const endpoint = "https://hadir.example/api/test";

function streamRequest(chunks, headers = {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Request(endpoint, {
    method: "POST",
    headers,
    body,
    duplex: "half",
  });
}

test("rejects an oversized declared body before reading the stream", async () => {
  let pullCount = 0;
  const body = new ReadableStream({
    pull(controller) {
      pullCount += 1;
      controller.enqueue(new Uint8Array(1));
    },
  });
  const request = new Request(endpoint, {
    method: "POST",
    headers: { "content-length": "2048" },
    body,
    duplex: "half",
  });
  await Promise.resolve();
  const pullsBeforeCheck = pullCount;

  assert.equal(await requestWithBodyLimit(request, 1024), null);
  assert.equal(pullCount, pullsBeforeCheck);
});

test("enforces the actual streamed size when Content-Length is absent", async () => {
  const request = streamRequest(["123456", "789012"]);
  assert.equal(await requestWithBodyLimit(request, 10), null);
});

test("does not trust a too-small Content-Length", async () => {
  const request = streamRequest(["123456", "789012"], { "content-length": "1" });
  assert.equal(await requestWithBodyLimit(request, 10), null);
});

test("accepts a body exactly at the limit and preserves multipart parsing", async () => {
  const boundary = "hadir-body-limit-test";
  const multipart =
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="label"\r\n\r\n' +
    "ok\r\n" +
    `--${boundary}--\r\n`;
  const request = new Request(endpoint, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: multipart,
  });
  const maxBytes = new TextEncoder().encode(multipart).byteLength;

  const bounded = await requestWithBodyLimit(request, maxBytes);
  assert.ok(bounded);
  assert.equal(bounded.headers.get("content-type"), `multipart/form-data; boundary=${boundary}`);
  assert.equal((await bounded.formData()).get("label"), "ok");
});

test("returns an empty-body request unchanged", async () => {
  const request = new Request(endpoint, { method: "POST" });
  assert.equal(await requestWithBodyLimit(request, 1), request);
});
