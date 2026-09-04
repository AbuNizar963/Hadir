import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/company-logo.ts", import.meta.url);
let source = readFileSync(file, "utf8");

// patch-company-logo-cache-version.mjs is the canonical upload-version patch.
// If it has already transformed the source during this same build, there is
// nothing else to do. Keeping this script idempotent prevents the deploy check
// from failing merely because patch order changed.
if (source.includes("const encodedVersion = encodeURIComponent(storedObject.httpEtag);") && source.includes("const publicUrl = logoUrl(req, encodedVersion);")) {
  console.log("Company logo upload version patch: canonical ETag URL patch already applied.");
  process.exit(0);
}

const oldBlock = `    const key = CURRENT_LOGO_KEY;\n    const publicUrl = logoUrl(req, key);\n    const bytes = new Uint8Array(await file.arrayBuffer());`;
const newBlock = `    const key = CURRENT_LOGO_KEY;\n    const bytes = new Uint8Array(await file.arrayBuffer());`;

if (!source.includes(oldBlock)) throw new Error("Company logo upload version patch: upload anchor not found; refusing unsafe replacement.");
source = source.replace(oldBlock, newBlock);

const oldReturn = `      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    try {`;
const newReturn = `      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    // The R2 key intentionally stays stable, but the public URL changes with\n    // the verified object's ETag so a replaced logo cannot be served from the\n    // browser cache under the same URL.\n    const encodedVersion = encodeURIComponent(storedObject.httpEtag || storedObject.etag);\n    const publicUrl = logoUrl(req, encodedVersion);\n\n    try {`;
if (!source.includes(oldReturn)) throw new Error("Company logo upload version patch: response anchor not found; refusing unsafe replacement.");
source = source.replace(oldReturn, newReturn);

writeFileSync(file, source, "utf8");
console.log("Company logo upload version patch: POST /api/company/logo returns an ETag-versioned URL for the newly stored R2 object.");
