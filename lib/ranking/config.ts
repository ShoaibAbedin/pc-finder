/** Ranking knobs — tweak freely. Weights should sum to 100. */
export const rankingConfig = {
  weights: {
    fit: 35, // match with target build tiers + requirements
    budget: 20, // price vs category budget
    discount: 20, // real discount vs OUR price history (or prebuilt vs parts, or OzBargain votes)
    convenience: 15, // Melbourne click & collect / known retailer
    stock: 10,
  },
  forYouSize: 30,
  forYouMaxPerCategory: 4,
  /** Listings priced above this multiple of the category budget are ignored entirely. */
  maxOverBudget: 1.5,
  /** A 20% drop below the 30-day high earns the full discount score. */
  fullDiscountPct: 0.2,
  /** OzBargain votes that earn the full "community deal" discount score. */
  fullOzVotes: 80,
  keepRankingRuns: 6,
  /** Fallback budget split (%) used if the AI targets aren't available. */
  defaultSplitPct: {
    gpu: 38,
    cpu: 18,
    motherboard: 11,
    ram: 8,
    storage: 7,
    psu: 7,
    case: 6,
    cooling: 5,
  } as Record<string, number>,
  /** Extras budget as % of total when the AI doesn't specify one. */
  defaultExtrasPct: { monitor: 18, peripheral: 8, software: 3 } as Record<string, number>,
};
