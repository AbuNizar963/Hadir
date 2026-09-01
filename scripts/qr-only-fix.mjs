import fs from "node:fs";
import { execFileSync } from "node:child_process";

const settingsPath = "src/pages/ManagerSettings.tsx";
const scanPath = "src/pages/EmployeeScan.tsx";
const legacySettings = execFileSync("git", ["show", "505908851972d6520543dd6393459750fe937bc2:src/pages/ManagerSettings.tsx"], { encoding: "utf8" });

const legacyMatch = legacySettings.match(/  const printQr = \(\) => \{[\s\S]*?(?=  const reset =)/);
if (!legacyMatch) throw new Error("QR-only fix aborted: legacy QR block was not found in the known backup commit.");

let settings = fs.readFileSync(settingsPath, "utf8");
const currentPattern = /  const printQr = \(\) => \{[\s\S]*?(?=  const resetCloudTestData =)/;
if (!currentPattern.test(settings)) throw new Error("QR-only fix aborted: current printQr block does not match the expected production version.");
settings = settings.replace(currentPattern, legacyMatch[0]);
fs.writeFileSync(settingsPath, settings);

let scan = fs.readFileSync(scanPath, "utf8");
const cameraOld = 'video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 } }, audio: false';
const cameraNew = 'video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, aspectRatio: { ideal: 16 / 9 } }, audio: false';
if (!scan.includes(cameraOld)) throw new Error("QR-only fix aborted: expected camera constraints not found.");
scan = scan.replace(cameraOld, cameraNew);

const timerOld = 'scanTimerRef.current = window.setTimeout(() => void scan(), 250);';
const timerNew = 'scanTimerRef.current = window.setTimeout(() => void scan(), 120);';
const timerCount = scan.split(timerOld).length - 1;
if (timerCount !== 2) throw new Error(`QR-only fix aborted: expected 2 QR scan timers, found ${timerCount}.`);
scan = scan.replaceAll(timerOld, timerNew);

const initialOld = 'scanTimerRef.current = window.setTimeout(() => void scan(), 300);';
const initialNew = 'scanTimerRef.current = window.setTimeout(() => void scan(), 120);';
if (!scan.includes(initialOld)) throw new Error("QR-only fix aborted: initial QR scan timer not found.");
scan = scan.replace(initialOld, initialNew);
fs.writeFileSync(scanPath, scan);

console.log("QR-only patch applied: legacy QR design restored and QR scanning cadence optimized.");
// Temporary helper; removed automatically after successful verification.
// QR-only CI retry: use the repository's pinned Bun toolchain.
