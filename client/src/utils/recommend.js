import API_URL from "../config";

// Answers → the server's recommendation request (POST /api/recommend).
// Goals map onto catalogue categories; makeup lives in bridal sets.
const GOAL_TO_CATEGORY = { skincare: "skincare", makeup: "bridal", routine: "skincare", haircare: "haircare wig" };
const HAIR_CONCERN_LABELS = ["Edge Protection & Lace Tension"];

export function buildRecommendRequest({ goal, skinType, hairType, concerns, toneName, profile = {} }) {
  const hairConcerns = concerns.filter((c) => HAIR_CONCERN_LABELS.includes(c));
  const skinConcerns = concerns.filter((c) => !HAIR_CONCERN_LABELS.includes(c));
  const clip = (t) => String(t || "").slice(0, 200);
  return {
    lookingFor: clip(GOAL_TO_CATEGORY[goal] || "skincare"),
    skinType: clip(skinType),
    hairType: clip(hairType),
    skinConcerns: clip([...skinConcerns, toneName ? `${toneName} undertone` : ""].filter(Boolean).join(", ")),
    hairConcerns: clip(hairConcerns.join(", ")),
    budget: clip(profile.budget),
    occasion: clip(profile.occasion),
  };
}

export async function fetchMatches(body) {
  const res = await fetch(`${API_URL}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Recommendation request failed");
  const data = await res.json();
  return (data.recommendations || [])
    .filter((r) => r && r.product && r.product._id)
    .map((r) => ({ ...r.product, reason: r.reason, tip: r.tip }));
}
