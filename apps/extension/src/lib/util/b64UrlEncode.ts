export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...input))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
