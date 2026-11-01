export function parseRupeesToPaise(value: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupeesPart, paisePart = ""] = value.split(".");
  const rupees = Number(rupeesPart);
  const paise = Number((paisePart + "00").slice(0, 2));
  const totalPaise = rupees * 100 + paise;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 1) {
    return null;
  }

  return totalPaise;
}
