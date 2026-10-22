declare module "qrcode" {
  type Options = { type: "png"; width?: number; margin?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H" };
  const QRCode: { toBuffer(text: string, options: Options): Promise<Uint8Array> };
  export default QRCode;
}
