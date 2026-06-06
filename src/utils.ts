export function getContrastColor(hexColor: string) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1b3329' : '#fcfbf9'; // japandi-900 or japandi-50
}

type BirthdayParts = {
  year: number;
  month: number;
  day: number;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function buildBirthdayParts(year: number, month: number, day: number): BirthdayParts | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return { year, month, day };
}

function parseBirthdayParts(value: string): BirthdayParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    return buildBirthdayParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return buildBirthdayParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  return null;
}

export function formatBirthdayDisplay(value?: string | null) {
  if (!value) return '';
  const parts = parseBirthdayParts(value);
  if (!parts) return value.trim();
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function normalizeBirthdayInput(value: string) {
  const parts = parseBirthdayParts(value);
  if (!parts) return null;
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
