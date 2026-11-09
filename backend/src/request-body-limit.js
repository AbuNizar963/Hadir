/**
 * Read a request body with a strict byte ceiling before a parser such as
 * Request.formData() or Request.json() can allocate an unbounded body.
 * Returns null when the declared or actual body exceeds maxBytes.
 * The returned Request preserves the URL, method, headers, and abort signal.
 *
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<Request|null>}
 */
export async function requestWithBodyLimit(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer");
  }

  const declaredLength = request.headers.get("content-length")?.trim();
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    return null;
  }

  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers(request.headers);
  // Do not carry a client-supplied Content-Length into the reconstructed body.
  headers.delete("content-length");

  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
  });
}
