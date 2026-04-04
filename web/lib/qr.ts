import QRCode from "qrcode";

export async function generateQRDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 256, margin: 2 });
}

export async function generateQRBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: 512, margin: 2 });
}
