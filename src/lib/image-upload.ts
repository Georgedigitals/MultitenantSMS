export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const IMAGE_SIGNATURES: Array<{ mimeType: string; extension: string; matches: (data: Buffer) => boolean }> = [
  { mimeType: 'image/jpeg', extension: 'jpg', matches: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  { mimeType: 'image/png', extension: 'png', matches: (data) => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: 'image/gif', extension: 'gif', matches: (data) => data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6)) },
  { mimeType: 'image/webp', extension: 'webp', matches: (data) => data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' },
];

export function detectRasterImage(data: Buffer) {
  return IMAGE_SIGNATURES.find((signature) => signature.matches(data)) ?? null;
}
