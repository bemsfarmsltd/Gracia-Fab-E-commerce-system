// AI models used across the API. Providers retire model names from time to
// time; when one stops working, set GEMINI_MODEL / GROQ_MODEL on Render to a
// current model instead of changing code. Read lazily so dotenv has loaded.
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.0-flash";
export const groqModel = () => process.env.GROQ_MODEL || "llama-3.1-8b-instant";

// Owner-confirmed facts the AI assistants may use (21 Nov 2026). Keep in step
// with the About page; don't add anything the owner hasn't confirmed.
export const STORE_FACTS = `About Gracia Fab (use only these facts about the business):
- Gracia Fab is a beauty store and part of Bems Group, founded in 2024 in Umuahia North, Umuahia, Abia State, Nigeria. It started as a physical store and now also sells online.
- It buys and sells beauty, skin and hair products and a small range of wigs.
- In the store: a hair salon (hairstyles and wig installs), bridal makeup by staff, bridal accessories, and consultations with the MD about skin, hair and wig problems.
- Store hours: 8am to 6pm.
- Online orders are delivered to all 36 states and the FCT for a flat ₦2,500. Payment is by card, bank transfer or USSD through Monnify.
- Customers can earn 1 loyalty point per ₦100 spent; 100 points = ₦500 off.
Rules: don't invent prices for services, delivery times, guarantees, certifications, hair origin, reviews, popularity or medical claims. If you don't know something (for example service prices or booking), suggest visiting the store or messaging on WhatsApp from the link at the bottom of the website.`;
