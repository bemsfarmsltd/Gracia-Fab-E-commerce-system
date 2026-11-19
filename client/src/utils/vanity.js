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
  if (/^\d{4}-\d{2}-\d{2}$/.test(local.weddingDate || "") && local.weddingDate >= todayInNigeria()) out.weddingDate = local.weddingDate;
  return out;
}

// Today in Nigeria (UTC+1) as YYYY-MM-DD, for date inputs and comparisons.
export function todayInNigeria(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// "Wednesday 30 December 2026" for a YYYY-MM-DD date (no timezone drift).
export function longDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function shortDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function countdownText(daysLeft) {
  if (daysLeft === 0) return "Today's the day";
  if (daysLeft === 1) return "1 day to go";
  return `${daysLeft.toLocaleString("en-NG")} days to go`;
}
