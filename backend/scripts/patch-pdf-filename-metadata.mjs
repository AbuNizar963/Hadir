import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/report-pdf.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `    return new Response(rendered.body, {\n      status: 200,\n      headers: {\n        ...cors(responseOrigin),\n        "content-type": "application/pdf",\n        "content-disposition": \`attachment; filename="\${filename.replace(/[^\\x20-\\x7E]/g, "_")}"\`,\n        "cache-control": "no-store, no-cache, must-revalidate",\n      },\n    });`;

const newBlock = `    const asciiFilename = filename.replace(/[^\\x20-\\x7E]/g, "_");\n    const encodedFilename = encodeURIComponent(filename);\n    return new Response(rendered.body, {\n      status: 200,\n      headers: {\n        ...cors(responseOrigin),\n        "content-type": "application/pdf",\n        // Keep an ASCII fallback for older clients and provide the full UTF-8\n        // filename for browsers and share/download targets that support RFC 5987.\n        "content-disposition": \`attachment; filename="\${asciiFilename}"; filename*=UTF-8''\${encodedFilename}\`,\n        "cache-control": "no-store, no-cache, must-revalidate",\n      },\n    });`;

if (source.includes(newBlock)) {
  console.log("PDF filename metadata patch: already applied.");
} else if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  writeFileSync(file, source, "utf8");
  console.log("PDF filename metadata patch: full UTF-8 filename is now exposed via Content-Disposition.");
} else {
  throw new Error("PDF filename metadata patch: expected response header anchor not found; refusing unsafe replacement.");
}
