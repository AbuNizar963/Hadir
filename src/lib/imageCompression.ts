export interface ProfileImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: "image/webp" | "image/jpeg";
}

const DEFAULT_OPTIONS: Required<ProfileImageCompressionOptions> = {
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.78,
  type: "image/webp",
};

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

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

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

  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("تعذر ضغط صورة الموظف.")),
      settings.type,
      settings.quality,
    );
  });

  return blobToDataUrl(compressed);
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
