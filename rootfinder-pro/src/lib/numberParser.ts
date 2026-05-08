export function parseNumericInput(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number.parseFloat(normalized);
}
