import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const fixed = '<img src={"https://api.qrserver.com/v1/create-qr-code/?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=" + encodeURIComponent(s.qrCode || loginUrl)} alt="QR"';
const qrImagePattern = /<img src=\{.*?api\.qrserver\.com\/v1\/create-qr-code\/\?.*?\} alt="QR"/;

if (source.includes(fixed)) {
  console.log("ManagerSettings QR patch: safe QR URL already present.");
} else if (qrImagePattern.test(source)) {
  source = source.replace(qrImagePattern, fixed);
  writeFileSync(file, source, "utf8");
  console.log("ManagerSettings QR patch: normalized the generated QR image JSX safely.");
} else {
  throw new Error("ManagerSettings QR patch anchor not found; refusing unsafe replacement.");
}
