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
  forYouMaxPerCategory: 5,
  /** How much a category matters when ordering For You (multiplies the score). */
  categoryImportance: {
    gpu: 1,
    prebuilt: 1,
    cpu: 0.95,
    monitor: 0.9,
    motherboard: 0.85,
    ram: 0.85,
    storage: 0.8,
    psu: 0.72,
    case: 0.72,
    cooling: 0.68,
    peripheral: 0.75,
    software: 0.6,
  } as Record<string, number>,
  /** Max For You slots per category. */
  categoryCap: { gpu: 5, prebuilt: 5, cpu: 4, monitor: 4, motherboard: 3, ram: 3, storage: 3, psu: 2, case: 2, cooling: 2, peripheral: 3, software: 1 } as Record<string, number>,
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
