// Minimal Buffer shim for browser environments. Required because panic-overlay →
// stacktracey → get-source → data-uri-to-buffer (v2) uses Node's Buffer API, which
// doesn't exist in browsers. This can be removed once get-source ships a version
// that depends on data-uri-to-buffer v4+, which uses Uint8Array instead.
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from(
      data: string,
      encoding: string,
    ): Uint8Array & { type?: string; typeFull?: string; charset?: string } {
      if (encoding === 'base64') {
        const bin = atob(data)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return bytes as Uint8Array & {
          type?: string
          typeFull?: string
          charset?: string
        }
      }
      return new TextEncoder().encode(data) as Uint8Array & {
        type?: string
        typeFull?: string
        charset?: string
      }
    },
  } as unknown as typeof Buffer
}
