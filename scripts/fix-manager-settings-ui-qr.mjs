import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const fail = (message) => {
  throw new Error(`ManagerSettings QR patch: ${message}; refusing unsafe replacement.`);
};

const qrImport = 'import { QRCodeSVG } from "qrcode.react";';
if (!source.includes(qrImport)) {
  const importAnchor = 'import { useEffect, useRef, useState } from "react";';
  if (!source.includes(importAnchor)) fail("React import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${qrImport}`);
}

const remoteQrPattern = /<img src=\{(?:`https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=\$\{encodeURIComponent\(s\.qrCode \|\| loginUrl\)\}`|"https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=700x700&ecc=H&margin=3&color=111111&bgcolor=ffffff&data=" \+ encodeURIComponent\(s\.qrCode \|\| loginUrl\))\} alt="QR" className="(?:w-full h-full|h-full w-full)"(?: loading="eager")?\s*\/>/;
const localQr = '<QRCodeSVG value={s.qrCode || loginUrl} size={700} level="H" includeMargin bgColor="#ffffff" fgColor="#111111" className="block w-full h-full" aria-label="QR" />';

if (remoteQrPattern.test(source)) {
  source = source.replace(remoteQrPattern, localQr);
} else if (!source.includes(localQr)) {
  fail("QR image anchor not found");
}

const printStart = source.indexOf("  const printQr = () => {");
const resetStart = source.indexOf("\n  const reset = () =>", printStart);
if (printStart < 0 || resetStart < 0) fail("print function boundaries not found");

const printFunction = [
  '  const printQr = () => {',
  '    const sheet = printRef.current;',
  '    if (!sheet) {',
  '      toast.error("تعذر تجهيز رمز QR للطباعة", "افتح قسم رمز الموقع ثم حاول مرة أخرى.");',
  '      return;',
  '    }',
  '',
  '    const styleId = "hadir-qr-print-style";',
  '    let style = document.getElementById(styleId) as HTMLStyleElement | null;',
  '    if (!style) {',
  '      style = document.createElement("style");',
  '      style.id = styleId;',
  '      document.head.appendChild(style);',
  '    }',
  '',
  '    style.textContent = `@page {',
  '  size: A4 portrait;',
  '  margin: 0;',
  '}',
  '',
  '@media print {',
  '  html,',
  '  body {',
  '    margin: 0 !important;',
  '    padding: 0 !important;',
  '    width: 210mm !important;',
  '    min-height: 297mm !important;',
  '    background: #fff !important;',
  '    color: #111 !important;',
  '    font-family: \'Cairo\', system-ui, sans-serif !important;',
  '  }',
  '',
  '  body > * {',
  '    visibility: hidden !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet,',
  '  #hadir-qr-print-sheet * {',
  '    visibility: visible !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet {',
  '    position: fixed !important;',
  '    inset: 0 !important;',
  '    width: 210mm !important;',
  '    min-height: 297mm !important;',
  '    margin: 0 !important;',
  '    padding: 14mm !important;',
  '    box-sizing: border-box !important;',
  '    display: flex !important;',
  '    flex-direction: column !important;',
  '    align-items: center !important;',
  '    justify-content: center !important;',
  '    gap: 5mm !important;',
  '    border: 0 !important;',
  '    border-radius: 0 !important;',
  '    box-shadow: none !important;',
  '    background: #fff !important;',
  '    color: #111 !important;',
  '    font-family: \'Cairo\', system-ui, sans-serif !important;',
  '    text-align: center !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > b {',
  '    display: block !important;',
  '    margin: 0 !important;',
  '    font-family: \'Cairo\', system-ui, sans-serif !important;',
  '    font-size: 24px !important;',
  '    line-height: 1.35 !important;',
  '    font-weight: 800 !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > div {',
  '    width: 122mm !important;',
  '    height: 122mm !important;',
  '    margin: 0 !important;',
  '    padding: 4mm !important;',
  '    box-sizing: border-box !important;',
  '    border: 3mm solid #16a34a !important;',
  '    border-radius: 8mm !important;',
  '    background: #fff !important;',
  '    box-shadow: 0 2mm 8mm rgba(22, 163, 74, 0.12) !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > div > div {',
  '    width: 100% !important;',
  '    height: 100% !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet svg {',
  '    width: 100% !important;',
  '    height: 100% !important;',
  '    display: block !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > div > div > div {',
  '    width: 15mm !important;',
  '    height: 15mm !important;',
  '    border-radius: 4mm !important;',
  '    border-width: 2mm !important;',
  '    box-shadow: 0 1mm 4mm rgba(0, 0, 0, 0.18) !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > div > div > div img {',
  '    width: 100% !important;',
  '    height: 100% !important;',
  '    object-fit: contain !important;',
  '  }',
  '',
  '  #hadir-qr-print-sheet > small {',
  '    display: block !important;',
  '    margin: 0 !important;',
  '    font-family: \'Cairo\', system-ui, sans-serif !important;',
  '    font-size: 15px !important;',
  '    line-height: 1.5 !important;',
  '    font-weight: 600 !important;',
  '    direction: ltr !important;',
  '  }',
  '}',
  '`;',
  '',
  '    const cleanup = () => {',
  '      style?.remove();',
  '    };',
  '',
  '    window.addEventListener("afterprint", cleanup, { once: true });',
  '    window.requestAnimationFrame(() => {',
  '      window.requestAnimationFrame(() => {',
  '        window.print();',
  '      });',
  '    });',
  '  };',
].join("\n");

source = source.slice(0, printStart) + printFunction + source.slice(resetStart);

const printSheetPattern = /<div ref=\{printRef\} className="[^"]*">/;
const printSheetReplacement = '<div id="hadir-qr-print-sheet" ref={printRef} className="$&">';
const printSheetMatch = source.match(printSheetPattern);
if (printSheetMatch) {
  source = source.replace(printSheetPattern, printSheetMatch[0].replace('<div ref={printRef}', '<div id="hadir-qr-print-sheet" ref={printRef}'));
} else if (!source.includes('id="hadir-qr-print-sheet" ref={printRef}')) {
  fail("print sheet anchor not found");
}

writeFileSync(file, source, "utf8");
console.log("ManagerSettings QR patch: switched to local QR SVG and same-document A4 printing with Cairo typography.");
