import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/company-logo.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `    const key = CURRENT_LOGO_KEY;\n    const publicUrl = logoUrl(req, key);\n    const bytes = new Uint8Array(await file.arrayBuffer());\n\n    await env.PROFILE_IMAGES.put(key, bytes, {`;

const newBlock = `    const key = CURRENT_LOGO_KEY;\n    const bytes = new Uint8Array(await file.arrayBuffer());\n\n    await env.PROFILE_IMAGES.put(key, bytes, {`;

if (source.includes("const encodedVersion = encodeURIComponent(storedObject.httpEtag);")) {
  console.log("Company logo cache-version patch: already applied.");
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  throw new Error("Company logo cache-version patch: upload anchor not found; refusing unsafe replacement.");
}

source = source.replace(oldBlock, newBlock);
const headAnchor = `    if (!storedObject) {\n      console.error("company logo R2 persistence verification failed", key);\n      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    try {`;
const headReplacement = `    if (!storedObject) {\n      console.error("company logo R2 persistence verification failed", key);\n      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    // The R2 key intentionally stays stable, but the public URL gets the\n    // object's ETag so browsers immediately display a newly uploaded logo\n    // instead of serving a previously cached image.\n    const encodedVersion = encodeURIComponent(storedObject.httpEtag);\n    const publicUrl = logoUrl(req, encodedVersion);\n\n    try {`;
if (!source.includes(headAnchor)) {
  throw new Error("Company logo cache-version patch: R2 verification anchor not found; refusing unsafe replacement.");
}
source = source.replace(headAnchor, headReplacement);
writeFileSync(file, source, "utf8");
console.log("Company logo cache-version patch: logo URLs now change with the stored R2 ETag after every successful upload.");
