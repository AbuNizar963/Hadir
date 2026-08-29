import { BrowserQRCodeReader } from "@zxing/browser";

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

/**
 * Keep the native Barcode Detection API when the browser provides it.
 * For browsers that do not, install a standards-shaped QR detector backed by
 * ZXing. This lets the existing scanner UI use one code path on Android,
 * iOS, desktop browsers, and embedded PWA browsers.
 */
if (typeof window !== "undefined" && !window.BarcodeDetector) {
  const reader = new BrowserQRCodeReader();

  class ZXingBarcodeDetector implements BarcodeDetectorLike {
    constructor(_options?: { formats?: string[] }) {}

    async detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> {
      try {
        const result = reader.decode(source as HTMLVideoElement | HTMLImageElement);
        const rawValue = result.getText()?.trim();
        return rawValue ? [{ rawValue }] : [];
      } catch {
        // ZXing throws NotFoundException while the current frame has no QR.
        // That is a normal scanner state, not an application error.
        return [];
      }
    }
  }

  window.BarcodeDetector = ZXingBarcodeDetector;
}

export {};
