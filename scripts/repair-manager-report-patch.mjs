import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("./patch-manager-reports-final.mjs", import.meta.url);
let source = readFileSync(file, "utf8");

// The validated patch must increment the final PRESENT bucket. A previous
// generated copy accidentally contained `else present;`, which makes its
// summary anchor impossible to match and aborts the production build.
const broken = 'else if (lm) late++; else present;';
const fixed = 'else if (lm) late++; else present++;';
if (source.includes(broken)) source = source.replace(broken, fixed);

writeFileSync(file, source, "utf8");
console.log("ManagerReports patch bootstrap: validated summary anchor.");
