import { STORE } from "../../utils/storeInfo";

// The shop's first-visit tour. Facts only from the owner-confirmed store
// details (utils/storeInfo.js, server/config/ai.js STORE_FACTS).
export const SHOP_TOUR_KEY = "gf-tour-shop-v1";

export const shopSteps = (user) => [
  {
    id: "welcome",
    eyebrow: "Welcome",
    image: "/icons/icon-192.png",
    title: "Welcome to Gracia Fab",
    body: (
      <>
        <p>Skincare, hair products, wigs and bridal beauty from our store in {STORE.area.split(",")[0]}, delivered across Nigeria.</p>
        <p>May we show you around? It takes less than a minute.</p>
      </>
    ),
  },
  {
    id: "shop",
    target: ['[data-tour="nav-products"]', '[data-tour="menu"]'],
    title: "Browse the shop",
    body: <p>Everything on our shelves, by category: skincare, haircare, wigs and bridal. Filter by your skin or hair type to see what suits you.</p>,
  },
  {
    id: "advisor",
    target: ['[data-tour="nav-recommend"]', '[data-tour="menu"]'],
    title: "Not sure what to choose?",
    body: <p>Our <strong>Beauty Advisor</strong> asks a few questions about your skin, hair and occasion, then suggests products from our shelves.</p>,
  },
  {
    id: "concierge",
    target: '[data-tour="concierge"]',
    placement: "left",
    title: "Ask us anything",
    body: <p>Questions about a product, delivery or booking a salon appointment? Tap here to chat. You can also reach the store on WhatsApp: {STORE.phoneDisplay}.</p>,
  },
  {
    id: "account",
    target: ['[data-tour="account"]', '[data-tour="menu"]'],
    title: user ? "Your Vanity" : "Your own space",
    body: user
      ? <p>Your orders, saved items and beauty profile live in <strong>My Vanity</strong>. You earn 1 loyalty point for every ₦100 you spend; 100 points take ₦500 off.</p>
      : <p>Create a free account to save favourites, track orders and keep your beauty profile in <strong>My Vanity</strong>. You earn 1 loyalty point for every ₦100 you spend.</p>,
  },
  {
    id: "cart",
    target: '[data-tour="cart"]',
    title: "Your bag",
    body: <p>Pay securely by card, bank transfer or USSD through Monnify. Delivery to all 36 states and the FCT is a flat ₦2,500.</p>,
  },
  {
    id: "done",
    eyebrow: "You're all set",
    title: "Enjoy your visit",
    body: (
      <>
        <p>Prefer to shop in person? Visit us in {STORE.area}, {STORE.hours}.</p>
        <p>You can replay this tour from the link at the bottom of any page.</p>
      </>
    ),
    primary: "Start shopping",
  },
];
