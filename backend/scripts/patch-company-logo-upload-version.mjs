import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/company-logo.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `    const key = CURRENT_LOGO_KEY;\n    const publicUrl = logoUrl(req, key);\n    const bytes = new Uint8Array(await file.arrayBuffer());`;
const newBlock = `    const key = CURRENT_LOGO_KEY;\n    const bytes = new Uint8Array(await file.arrayBuffer());`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error("Company logo upload version patch: upload anchor not found; refusing unsafe replacement.");
  source = source.replace(oldBlock, newBlock);
}

const oldUrl = `    const storedObject = await env.PROFILE_IMAGES.head(key);\n    if (!storedObject) {`;
const newUrl = `    const storedObject = await env.PROFILE_IMAGES.head(key);\n    if (!storedObject) {`;
if (!source.includes(newUrl)) throw new Error("Company logo upload version patch: R2 verification anchor not found; refusing unsafe replacement.");

const oldReturn = `      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    try {`;
const newReturn = `      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    // The R2 ETag changes whenever the canonical object is replaced. Include it\n    // in the URL returned to the settings UI so the browser cannot reuse the old\n    // image from its cache even though the R2 object keeps the same stable key.\n    const publicUrl = logoUrl(req, storedObject.etag);\n\n    try {`;
if (!source.includes(newReturn)) {
  if (!source.includes(oldReturn)) throw new Error("Company logo upload version patch: response anchor not found; refusing unsafe replacement.");
  source = source.replace(oldReturn, newReturn);
}

if (!source.includes("const publicUrl = logoUrl(req, storedObject.etag);")) {
  throw new Error("Company logo upload version patch: ETag URL was not installed; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("Company logo upload version patch: POST /api/company/logo now returns an ETag-versioned URL for the newly stored R2 object.");
