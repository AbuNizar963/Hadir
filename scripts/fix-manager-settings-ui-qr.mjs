import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const broken = '<img src={\\`https://api.qrserver.com/v1/create-qr-code/?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=\\${encodeURIComponent(s.qrCode || loginUrl)}\\`}';
const fixed = '<img src={"https://api.qrserver.com/v1/create-qr-code/?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=" + encodeURIComponent(s.qrCode || loginUrl)}';

if (source.includes(broken)) {
  source = source.replace(broken, fixed);
  writeFileSync(file, source, "utf8");
  console.log("ManagerSettings QR patch: replaced generated template URL with safe JSX string concatenation.");
} else if (source.includes(fixed)) {
  console.log("ManagerSettings QR patch: safe QR URL already present.");
} else {
  throw new Error("ManagerSettings QR patch anchor not found; refusing unsafe replacement.");
}
