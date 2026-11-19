// The choices a customer can make in their My Vanity beauty profile, and how
// each one maps onto the tags already on products (Product.suitableFor).
// The catalogue uses ~45 loose concern words ("dullness", "dull skin",
// "glow"…); customers pick from these grouped concerns instead.

export const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];
export const HAIR_TYPES = ["straight", "wavy", "curly", "coily"];
export const SHOPPING_FOR = ["skincare", "haircare", "wig", "bridal"];
export const BUDGETS = ["budget", "moderate", "premium"];

export const SKIN_CONCERNS = {
  "dark-spots": { label: "Dark spots & uneven tone", terms: ["dark spots", "uneven tone", "scars", "brightening"] },
  dullness: { label: "Dullness", terms: ["dullness", "dull skin", "glow", "brightening"] },
  dryness: { label: "Dryness & flaking", terms: ["dryness", "flakiness", "rough skin", "barrier damage"] },
  acne: { label: "Acne & pores", terms: ["acne", "large pores", "texture"] },
  aging: { label: "Fine lines & firmness", terms: ["fine lines", "aging", "firmness"] },
  sun: { label: "Sun protection", terms: ["sun protection", "sun damage"] },
};

export const HAIR_CONCERNS = {
  breakage: { label: "Breakage & thinning", terms: ["breakage", "damage", "thinning", "hair loss"] },
  growth: { label: "Hair growth", terms: ["hair growth", "thinning", "hair loss"] },
  scalp: { label: "Dandruff & scalp care", terms: ["dandruff", "itchy scalp", "scalp irritation", "scalp care"] },
  frizz: { label: "Frizz & tangles", terms: ["frizz", "tangles"] },
};

// Price bands for the budget answer (per product, in naira).
export const BUDGET_RANGES = {
  budget: [0, 5000],
  moderate: [5000, 15000],
  premium: [15000, Infinity],
};

// What counts towards the profile being "complete".
export const PROFILE_STEPS = ["skinType", "hairType", "skinConcerns", "shoppingFor", "undertone"];

export const profileOptions = () => ({
  skinTypes: SKIN_TYPES,
  hairTypes: HAIR_TYPES,
  shoppingFor: SHOPPING_FOR,
  budgets: BUDGETS,
  skinConcerns: Object.entries(SKIN_CONCERNS).map(([id, c]) => ({ id, label: c.label })),
  hairConcerns: Object.entries(HAIR_CONCERNS).map(([id, c]) => ({ id, label: c.label })),
});
