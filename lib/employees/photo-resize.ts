const OUTPUT_SIZE = 512;
const OUTPUT_QUALITY = 0.86;

/**
 * Center-crops a chosen photo to a square and shrinks it to 512px JPEG in the
 * browser, so uploads stay small no matter what size the camera produced.
 */
export async function prepareEmployeePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");

  let bitmap: ImageBitmap;
  try {
    // Applies the photo's EXIF rotation so phone pictures aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format isn't supported. Use a JPG or PNG.");
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(OUTPUT_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the photo");
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo"))),
        "image/jpeg",
        OUTPUT_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
