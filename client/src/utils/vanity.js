// Helpers for the My Vanity page (kept out of the component file so React
// fast refresh keeps working).

// Nigeria is UTC+1 all year.
export function greeting(date = new Date()) {
  const h = (date.getUTCHours() + 1) % 24;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Answers from the AI tools on this device (localStorage), mapped onto the
// account profile's choices. Only offered to the customer, never saved
// without asking (it could be a shared phone).
const SKIN_WORDS = { dark: "dark-spots", spot: "dark-spots", uneven: "dark-spots", hyperpig: "dark-spots", dull: "dullness", bright: "dullness", dry: "dryness", flak: "dryness", acne: "acne", pore: "acne", breakout: "acne", aging: "aging", "fine line": "aging", wrinkle: "aging", firm: "aging", sun: "sun" };
const HAIR_WORDS = { break: "breakage", thin: "breakage", "hair loss": "growth", growth: "growth", dandruff: "scalp", scalp: "scalp", itch: "scalp", frizz: "frizz", tangle: "frizz" };

const pickWords = (text, words) => {
  const t = (Array.isArray(text) ? text.join(" ") : String(text || "")).toLowerCase();
  return [...new Set(Object.entries(words).filter(([w]) => t.includes(w)).map(([, id]) => id))];
};

export function profileFromDevice(local, options) {
  if (!local || !options) return {};
  const out = {};
  if (options.skinTypes.includes(local.skinType)) out.skinType = local.skinType;
  if (options.hairTypes.includes(local.hairType)) out.hairType = local.hairType;
  const skin = pickWords(local.skinConcerns, SKIN_WORDS);
  if (skin.length) out.skinConcerns = skin;
  const hair = pickWords(local.hairConcerns, HAIR_WORDS);
  if (hair.length) out.hairConcerns = hair;
  if (local.shoppingFor === "everything") out.shoppingFor = [...options.shoppingFor];
  else if (options.shoppingFor.includes(local.shoppingFor)) out.shoppingFor = [local.shoppingFor];
  const budget = options.budgets.find((b) => String(local.budget || "").toLowerCase().startsWith(b));
  if (budget) out.budget = budget;
  const tone = local.skinTone?.label || local.skinTone?.undertone;
  if (tone) out.undertone = String(tone).slice(0, 60);
  return out;
}
