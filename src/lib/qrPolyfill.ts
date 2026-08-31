import { BrowserQRCodeReader } from "@zxing/browser";

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type NativeBarcodeDetector = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

/**
 * Cross-browser QR detection fallback.
 *
 * Some browsers expose BarcodeDetector but have incomplete QR support, while
 * other browsers do not expose it at all. The scanner page uses this single
 * API, so keep the native detector when it works and transparently fall back
 * to ZXing when the native implementation is unavailable, unsupported, or
 * simply returns no QR result for the current video frame.
 */
if (typeof window !== "undefined") {
  const NativeDetector = window.BarcodeDetector as NativeBarcodeDetector | undefined;
  const reader = new BrowserQRCodeReader();

  class CompatibleBarcodeDetector implements BarcodeDetectorLike {
    private native: BarcodeDetectorLike | null = null;

    constructor(options?: { formats?: string[] }) {
      if (NativeDetector) {
        try {
          this.native = new NativeDetector(options);
        } catch {
          this.native = null;
        }
      }
    }

    async detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> {
      if (this.native) {
        try {
          const nativeCodes = await this.native.detect(source);
          if (nativeCodes.some((code) => code.rawValue?.trim())) return nativeCodes;
        } catch {
          // Fall through to ZXing.
        }
      }

      try {
        const result = reader.decode(source as HTMLVideoElement | HTMLImageElement);
        const rawValue = result.getText()?.trim();
        return rawValue ? [{ rawValue }] : [];
      } catch {
        // No QR in this frame is a normal scanner state.
        return [];
      }
    }
  }

  window.BarcodeDetector = CompatibleBarcodeDetector;
}

export {};
