export function spiceIdentifier(source: string): string {
  return source.replace(/[^A-Za-z0-9_]/g, "_");
}
