export function parseRupeesToPaise(value: string): number | null {
  if (!/^\\d{1,7}(?:\\.\\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupeesPart, paisePart = ""] = value.split(".");
  const paise = BigInt(rupeesPart) * 100n + BigInt((paisePart + "00").slice(0, 2));

  if (paise < 1n || paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(paise);
}
