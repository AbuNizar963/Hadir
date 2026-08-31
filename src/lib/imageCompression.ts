export interface ProfileImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  minQuality?: number;
  maxBytes?: number;
  type?: "image/webp" | "image/jpeg";
}

const DEFAULT_OPTIONS: Required<ProfileImageCompressionOptions> = {
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.78,
  minQuality: 0.45,
  maxBytes: 100 * 1024,
  type: "image/webp",
};

/** Compresses a profile image in the browser and guarantees the configured byte limit. */
export async function compressProfileImageDataUrl(
  dataUrl: string,
  options: ProfileImageCompressionOptions = {},
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("صورة الموظف غير صالحة.");
  }

  const settings = { ...DEFAULT_OPTIONS, ...options };
  const image = await loadImage(dataUrl);
  const scale = Math.min(
    settings.maxWidth / image.naturalWidth,
    settings.maxHeight / image.naturalHeight,
    1,
  );

  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));

  for (let dimensionPass = 0; dimensionPass < 4; dimensionPass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر معالجة صورة الموظف.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (settings.type === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);

    let quality = Math.min(0.95, Math.max(settings.minQuality, settings.quality));
    for (let qualityPass = 0; qualityPass < 8; qualityPass += 1) {
      const blob = await canvasToBlob(canvas, settings.type, quality);
      if (blob.size <= settings.maxBytes) return blobToDataUrl(blob);
      quality = Math.max(settings.minQuality, quality - 0.07);
      if (quality <= settings.minQuality) break;
    }

    width = Math.max(128, Math.floor(width * 0.82));
    height = Math.max(128, Math.floor(height * 0.82));
  }

  throw new Error("تعذر ضغط صورة الموظف إلى أقل من 100 كيلوبايت. اختر صورة أصغر.");
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("تعذر ضغط صورة الموظف.")),
      type,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذر قراءة صورة الموظف."));
    image.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("تعذر تحويل الصورة المضغوطة."));
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة المضغوطة."));
    reader.readAsDataURL(blob);
  });
}
