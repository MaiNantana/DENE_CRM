export type TierBenefitsInput = string[] | string | null | undefined;

type TierLike = {
  benefits?: TierBenefitsInput;
  baht_per_point?: number | string | null;
  bahtPerPoint?: number | string | null;
  discount_percent?: number | string | null;
  discountPercent?: number | string | null;
  duration_days?: number | string | null;
  durationDays?: number | string | null;
};

const FIXED_POINTS_BENEFIT_RE = /^รับคะแนน\s*x\s*(\d+(?:\.\d+)?)$/i;
const FIXED_DISCOUNT_BENEFIT_RE = /^รับส่วนลด\s*(\d+(?:\.\d+)?)\s*%$/i;

function parseBenefitList(raw: TierBenefitsInput) {
  if (!raw) return [];

  let values: unknown[] = [];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        values = parsed;
      } else {
        values = [parsed];
      }
    } catch {
      values = [trimmed];
    }
  } else if (raw != null) {
    values = [raw];
  }

  return values
    .map(value => String(value ?? '').trim())
    .filter(Boolean);
}

export function normalizeTierBenefits(raw: TierBenefitsInput) {
  return parseBenefitList(raw).filter(
    value => !FIXED_POINTS_BENEFIT_RE.test(value) && !FIXED_DISCOUNT_BENEFIT_RE.test(value)
  );
}

export function getTierBahtPerPoint(tier: TierLike, fallback = 10) {
  const direct = Number(tier.baht_per_point ?? tier.bahtPerPoint);
  return Number.isFinite(direct) && direct > 0 ? direct : fallback;
}

export function getTierDiscountPercent(tier: TierLike, fallback = 0) {
  const directSource = tier.discount_percent ?? tier.discountPercent;
  if (directSource !== undefined && directSource !== null && String(directSource).trim() !== '') {
    const direct = Number(directSource);
    if (Number.isFinite(direct)) {
      if (direct > 0) return direct;

      const benefits = parseBenefitList(tier.benefits);
      for (const benefit of benefits) {
        const match = benefit.match(FIXED_DISCOUNT_BENEFIT_RE);
        if (match) return Math.max(Number(match[1]) || 0, 0);
      }

      return 0;
    }
  }

  const benefits = parseBenefitList(tier.benefits);
  for (const benefit of benefits) {
    const match = benefit.match(FIXED_DISCOUNT_BENEFIT_RE);
    if (match) return Math.max(Number(match[1]) || 0, 0);
  }

  return fallback;
}

export function getTierDurationDays(tier: TierLike, fallback = 365) {
  const direct = Number(tier.duration_days ?? tier.durationDays);
  return Number.isFinite(direct) && direct >= 0 ? Math.floor(direct) : fallback;
}
