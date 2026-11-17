import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useBeautyProfile } from "../hooks/useBeautyProfile";
import { useToast } from "../hooks/useToast";
import GraciaLogo from "../components/GraciaLogo";
import EditProfileModal from "../components/EditProfileModal";
import LoyaltyWidget from "../components/LoyaltyWidget";
import SEO from "../components/SEO";
import API_URL from "../config";
import "../styles/Dashboard.css";

const DEFAULT_ADDRESS =
  "No 60 Enugu Road by Igbere Street, Umuahia, Abia, 440233 Umuahia Oyo, Nigeria";

// Available skin tone reference definitions
const SKIN_TONES = [
  {
    id: "fair",
    label: "Fair Complexion",
    emoji: "🌸",
    hex: "#FDDBB4",
    undertone: "Cool / Rosy Undertone",
    description: "Porcelain to pale — burns easily in the sun; thrives on daily mineral SPF 50+ and gentle barrier hydration.",
  },
  {
    id: "light",
    label: "Light Complexion",
    emoji: "🌼",
    hex: "#F5C89A",
    undertone: "Warm Neutral / Ivory",
    description: "Light beige to warm ivory — burns occasionally; responds well to Vitamin C brightening serums and gentle chemical exfoliants.",
  },
  {
    id: "medium",
    label: "Medium Complexion",
    emoji: "✨",
    hex: "#D4A574",
    undertone: "Golden / Warm Olive",
    description: "Golden to olive — rarely burns; thrives on Niacinamide pore refining, warm tone cosmetics, and daily UV protection.",
  },
  {
    id: "tan",
    label: "Tan / Warm Caramel",
    emoji: "🌻",
    hex: "#B8834A",
    undertone: "Warm Golden / Caramel",
    description: "Rich melanin with high natural resilience, but prone to post-inflammatory hyperpigmentation (PIH). Thrives on Vitamin C, Kojic Acid, and non-comedogenic hydration.",
  },
  {
    id: "deep",
    label: "Deep / Warm Chocolate",
    emoji: "🌹",
    hex: "#8B5E3C",
    undertone: "Rich Bronze / Warm Mahogany",
    description: "Deep melanin complexion — prone to surface ashiness and PIH marks. Thrives on squalane, unrefined shea butter, gentle retinoids, and zero-white-cast SPF.",
  },
  {
    id: "rich",
    label: "Rich / Deep Ebony",
    emoji: "💎",
    hex: "#4A2C1A",
    undertone: "Deep Espresso / Cool Ebony",
    description: "The deepest, most melanin-rich complexion. Thrives on botanical lipid oils (argan, marula), hydrating hyaluronic layers, and gold-flecked radiance enhancers.",
  },
];

// Curated routine blueprints by skin type
const getRoutineSteps = (skinType) => {
  const normalized = (skinType || "combination").toLowerCase();

  const routines = {
    oily: {
      morning: [
        {
          step: 1,
          type: "Sebum Balancing Toner",
          badge: "STEP 01 / BALANCE",
          timing: "Morning · Daily",
          instruction: "Controls excess oil, minimizes pores and prevents breakouts with niacinamide and witch hazel.",
          product: {
            _id: "prod-toner-mattifying",
            name: "Oily Skin Toner – Mattifying | Natural Outcome",
            brand: "Natural Outcome",
            price: 5500,
            rating: 4.3,
            reviews: 8,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634629/Mattifying_Skin_Toner_b7z9nr.webp",
          },
        },
        {
          step: 2,
          type: "Antioxidant Radiance Serum",
          badge: "STEP 02 / BRIGHTEN",
          timing: "Morning · Daily",
          instruction: "15% Vitamin C fades dark spots and evens skin tone without greasiness.",
          product: {
            _id: "prod-vit-c-serum",
            name: "Beauty Formulas Glow Vitamin C Serum",
            brand: "Beauty Formulas",
            price: 8500,
            rating: 4.5,
            reviews: 12,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634292/Beauty_Formulas_Vitamin_C_Serum_o7d1y6.jpg",
          },
        },
        {
          step: 3,
          type: "Hydrating Face & Body Mist",
          badge: "STEP 03 / HYDRATE",
          timing: "Morning · Daily",
          instruction: "Featherlight rose water and aloe vera mist gives weightless hydration.",
          product: {
            _id: "prod-rose-water-mist",
            name: "Rose Water Hydrating Face & Body Mist",
            brand: "Saltylicious",
            price: 4800,
            rating: 4.6,
            reviews: 14,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634898/Rose_Water_Hydrating_Mist_w0yuyl.webp",
          },
        },
        {
          step: 4,
          type: "Brightening Sunscreen SPF 50",
          badge: "STEP 04 / PROTECT",
          timing: "Morning · Daily",
          instruction: "Broad-spectrum SPF 50 protection that leaves zero white cast on melanin skin.",
          product: {
            _id: "prod-amaterasun-spf",
            name: "Amaterasun Brightening Sunscreen SPF 50",
            brand: "Amaterasun",
            price: 7200,
            rating: 4.9,
            reviews: 35,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635060/Brightening_Sunscreen_SPF_50_hsjqtj.avif",
          },
        },
      ],
      night: [
        {
          step: 1,
          type: "Sebum Balancing Toner",
          badge: "STEP 01 / PURIFY",
          timing: "Nightly",
          instruction: "Clarifies pores and prepares skin for nighttime active ingredients.",
          product: {
            _id: "prod-toner-mattifying",
            name: "Oily Skin Toner – Mattifying | Natural Outcome",
            brand: "Natural Outcome",
            price: 5500,
            rating: 4.3,
            reviews: 8,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634629/Mattifying_Skin_Toner_b7z9nr.webp",
          },
        },
        {
          step: 2,
          type: "Retinol Night Renewal Serum",
          badge: "STEP 02 / RESURFACE",
          timing: "Nightly",
          instruction: "0.5% retinol and peptides accelerate cell renewal and smooth skin texture overnight.",
          product: {
            _id: "prod-boost-lab-retinol",
            name: "Boost Lab Retinol Night Renewal Serum 30ml",
            brand: "Boost Lab",
            price: 12500,
            rating: 4.7,
            reviews: 18,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634770/Retinol_NIght_Serum_k1u4gi.webp",
          },
        },
        {
          step: 3,
          type: "Raw Shea Butter Deep Treatment",
          badge: "STEP 03 / NOURISH",
          timing: "Nightly",
          instruction: "Seals in hydration with nourishing shea butter and hyaluronic acid.",
          product: {
            _id: "prod-shea-moisture",
            name: "Shea Moisture Raw Shea Butter Deep Treatment",
            brand: "Shea Moisture",
            price: 6200,
            rating: 4.8,
            reviews: 20,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634451/Shea_Butter_Raw_mte3sa.jpg",
          },
        },
      ],
      weekly: [
        {
          step: 1,
          type: "Protein Repair Treatment",
          badge: "WEEKLY 01 / REPAIR",
          timing: "1x Weekly",
          instruction: "Keratin and biotin deeply strengthen hair fibers and prevent breakage.",
          product: {
            _id: "prod-baor-protein-mask",
            name: "PROTEIN REPAIR HAIR MASK - Baor",
            brand: "Baor",
            price: 6800,
            rating: 4.9,
            reviews: 32,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635792/Protein_Repair_Hair_mask_ymw7fd.webp",
          },
        },
        {
          step: 2,
          type: "Rosemary & Castor Growth Oil",
          badge: "WEEKLY 02 / STRENGTHEN",
          timing: "2x Weekly",
          instruction: "Stimulates hair follicles, treats dry scalp and boosts growth.",
          product: {
            _id: "prod-rosemary-hair-oil",
            name: "Artnaturals Organic Rosemary & Castor Hair Growth Oil",
            brand: "Artnaturals",
            price: 5900,
            rating: 4.6,
            reviews: 25,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635600/Hair_Growth_Oil_l6swgg.webp",
          },
        },
      ],
    },
    dry: {
      morning: [
        {
          step: 1,
          type: "Hydrating Face Mist",
          badge: "STEP 01 / REFRESH",
          timing: "Morning · Daily",
          instruction: "Refreshes skin with soothing rose water and hydrating hyaluronic acid.",
          product: {
            _id: "prod-rose-water-mist",
            name: "Rose Water Hydrating Face & Body Mist",
            brand: "Saltylicious",
            price: 4800,
            rating: 4.6,
            reviews: 14,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634898/Rose_Water_Hydrating_Mist_w0yuyl.webp",
          },
        },
        {
          step: 2,
          type: "Glow Vitamin C Serum",
          badge: "STEP 02 / RADIANCE",
          timing: "Morning · Daily",
          instruction: "Brightens dull skin and shields against environmental pollutants.",
          product: {
            _id: "prod-vit-c-serum",
            name: "Beauty Formulas Glow Vitamin C Serum",
            brand: "Beauty Formulas",
            price: 8500,
            rating: 4.5,
            reviews: 12,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634292/Beauty_Formulas_Vitamin_C_Serum_o7d1y6.jpg",
          },
        },
        {
          step: 3,
          type: "Raw Shea Butter Deep Treatment",
          badge: "STEP 03 / DEEP HYDRATION",
          timing: "Morning · Daily",
          instruction: "Locks in 24-hour hydration for dry and sensitive skin.",
          product: {
            _id: "prod-shea-moisture",
            name: "Shea Moisture Raw Shea Butter Deep Treatment",
            brand: "Shea Moisture",
            price: 6200,
            rating: 4.8,
            reviews: 20,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634451/Shea_Butter_Raw_mte3sa.jpg",
          },
        },
        {
          step: 4,
          type: "Brightening Sunscreen SPF 50",
          badge: "STEP 04 / PROTECT",
          timing: "Morning · Daily",
          instruction: "Nourishing broad-spectrum sunscreen with zero white cast.",
          product: {
            _id: "prod-amaterasun-spf",
            name: "Amaterasun Brightening Sunscreen SPF 50",
            brand: "Amaterasun",
            price: 7200,
            rating: 4.9,
            reviews: 35,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635060/Brightening_Sunscreen_SPF_50_hsjqtj.avif",
          },
        },
      ],
      night: [
        {
          step: 1,
          type: "Rose Water Mist",
          badge: "STEP 01 / PREP",
          timing: "Nightly",
          instruction: "Softens dry skin and prepares it for overnight cell renewal.",
          product: {
            _id: "prod-rose-water-mist",
            name: "Rose Water Hydrating Face & Body Mist",
            brand: "Saltylicious",
            price: 4800,
            rating: 4.6,
            reviews: 14,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634898/Rose_Water_Hydrating_Mist_w0yuyl.webp",
          },
        },
        {
          step: 2,
          type: "Retinol Night Renewal Serum",
          badge: "STEP 02 / RENEW",
          timing: "Nightly",
          instruction: "Retinol and peptides smooth fine lines and firm skin texture.",
          product: {
            _id: "prod-boost-lab-retinol",
            name: "Boost Lab Retinol Night Renewal Serum 30ml",
            brand: "Boost Lab",
            price: 12500,
            rating: 4.7,
            reviews: 18,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634770/Retinol_NIght_Serum_k1u4gi.webp",
          },
        },
        {
          step: 3,
          type: "Raw Shea Butter Deep Treatment",
          badge: "STEP 03 / BARRIER REPAIR",
          timing: "Nightly",
          instruction: "Prevents overnight moisture loss and restores skin barrier suppleness.",
          product: {
            _id: "prod-shea-moisture",
            name: "Shea Moisture Raw Shea Butter Deep Treatment",
            brand: "Shea Moisture",
            price: 6200,
            rating: 4.8,
            reviews: 20,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634451/Shea_Butter_Raw_mte3sa.jpg",
          },
        },
      ],
      weekly: [
        {
          step: 1,
          type: "Protein Repair Hair Mask",
          badge: "WEEKLY 01 / INTENSIVE CARE",
          timing: "1-2x Weekly",
          instruction: "Intensive repair mask restoring silky shine and softness.",
          product: {
            _id: "prod-baor-protein-mask",
            name: "PROTEIN REPAIR HAIR MASK - Baor",
            brand: "Baor",
            price: 6800,
            rating: 4.9,
            reviews: 32,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635792/Protein_Repair_Hair_mask_ymw7fd.webp",
          },
        },
        {
          step: 2,
          type: "Leave-In Moisturizing Spray",
          badge: "WEEKLY 02 / DETANGLE",
          timing: "As Needed",
          instruction: "Detangles, moisturizes and shields against heat and dryness.",
          product: {
            _id: "prod-nevitaly-spray",
            name: "Nevitaly Leave-in, moisturizing spray",
            brand: "Nevitaly",
            price: 4500,
            rating: 4.5,
            reviews: 10,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635955/Leave-in_Moisturizing_Spray_fzaajl.webp",
          },
        },
      ],
    },
    combination: {
      morning: [
        {
          step: 1,
          type: "Sebum Balancing Toner",
          badge: "STEP 01 / BALANCE",
          timing: "Morning · Daily",
          instruction: "Balances T-zone shine while keeping dry cheek zones comfortable.",
          product: {
            _id: "prod-toner-mattifying",
            name: "Oily Skin Toner – Mattifying | Natural Outcome",
            brand: "Natural Outcome",
            price: 5500,
            rating: 4.3,
            reviews: 8,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634629/Mattifying_Skin_Toner_b7z9nr.webp",
          },
        },
        {
          step: 2,
          type: "Vitamin C Brightening Serum",
          badge: "STEP 02 / BRIGHTEN",
          timing: "Morning · Daily",
          instruction: "Evens out skin tone and diminishes hyperpigmentation marks.",
          product: {
            _id: "prod-vit-c-serum",
            name: "Beauty Formulas Glow Vitamin C Serum",
            brand: "Beauty Formulas",
            price: 8500,
            rating: 4.5,
            reviews: 12,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634292/Beauty_Formulas_Vitamin_C_Serum_o7d1y6.jpg",
          },
        },
        {
          step: 3,
          type: "Hydrating Face & Body Mist",
          badge: "STEP 03 / HYDRATE",
          timing: "Morning · Daily",
          instruction: "Lightweight moisture balance with rose water and aloe vera.",
          product: {
            _id: "prod-rose-water-mist",
            name: "Rose Water Hydrating Face & Body Mist",
            brand: "Saltylicious",
            price: 4800,
            rating: 4.6,
            reviews: 14,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634898/Rose_Water_Hydrating_Mist_w0yuyl.webp",
          },
        },
        {
          step: 4,
          type: "Brightening Sunscreen SPF 50",
          badge: "STEP 04 / PROTECT",
          timing: "Morning · Daily",
          instruction: "Non-greasy, invisible sun protection ideal for Nigerian weather.",
          product: {
            _id: "prod-amaterasun-spf",
            name: "Amaterasun Brightening Sunscreen SPF 50",
            brand: "Amaterasun",
            price: 7200,
            rating: 4.9,
            reviews: 35,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635060/Brightening_Sunscreen_SPF_50_hsjqtj.avif",
          },
        },
      ],
      night: [
        {
          step: 1,
          type: "Sebum Balancing Toner",
          badge: "STEP 01 / PURIFY",
          timing: "Nightly",
          instruction: "Gently refines pores and removes daily city buildup.",
          product: {
            _id: "prod-toner-mattifying",
            name: "Oily Skin Toner – Mattifying | Natural Outcome",
            brand: "Natural Outcome",
            price: 5500,
            rating: 4.3,
            reviews: 8,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634629/Mattifying_Skin_Toner_b7z9nr.webp",
          },
        },
        {
          step: 2,
          type: "Retinol Night Renewal Serum",
          badge: "STEP 02 / RENEWAL",
          timing: "Nightly",
          instruction: "Stimulates cellular regeneration and targets fine texture.",
          product: {
            _id: "prod-boost-lab-retinol",
            name: "Boost Lab Retinol Night Renewal Serum 30ml",
            brand: "Boost Lab",
            price: 12500,
            rating: 4.7,
            reviews: 18,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634770/Retinol_NIght_Serum_k1u4gi.webp",
          },
        },
        {
          step: 3,
          type: "Raw Shea Butter Deep Treatment",
          badge: "STEP 03 / HYDRATE",
          timing: "Nightly",
          instruction: "Deeply hydrates without clogging pores.",
          product: {
            _id: "prod-shea-moisture",
            name: "Shea Moisture Raw Shea Butter Deep Treatment",
            brand: "Shea Moisture",
            price: 6200,
            rating: 4.8,
            reviews: 20,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634451/Shea_Butter_Raw_mte3sa.jpg",
          },
        },
      ],
      weekly: [
        {
          step: 1,
          type: "Protein Repair Hair Mask",
          badge: "WEEKLY 01 / REPAIR",
          timing: "1x Weekly",
          instruction: "Deep protein conditioning to nourish coily and textured hair.",
          product: {
            _id: "prod-baor-protein-mask",
            name: "PROTEIN REPAIR HAIR MASK - Baor",
            brand: "Baor",
            price: 6800,
            rating: 4.9,
            reviews: 32,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635792/Protein_Repair_Hair_mask_ymw7fd.webp",
          },
        },
        {
          step: 2,
          type: "Organic Rosemary & Castor Oil",
          badge: "WEEKLY 02 / NOURISH",
          timing: "2x Weekly",
          instruction: "Strengthens edges, nourishes scalp, and locks in root vitality.",
          product: {
            _id: "prod-rosemary-hair-oil",
            name: "Artnaturals Organic Rosemary & Castor Hair Growth Oil",
            brand: "Artnaturals",
            price: 5900,
            rating: 4.6,
            reviews: 25,
            image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635600/Hair_Growth_Oil_l6swgg.webp",
          },
        },
      ],
    },
  };

  return routines[normalized] || routines.combination;
};

// Authentic Gracia Fab staples for quick 1-click replenishment
const DEFAULT_EMPTIES = [
  {
    _id: "staple-vit-c",
    name: "Beauty Formulas Glow Vitamin C Serum",
    brand: "Beauty Formulas",
    price: 8500,
    category: "skincare",
    image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634292/Beauty_Formulas_Vitamin_C_Serum_o7d1y6.jpg",
  },
  {
    _id: "staple-shea",
    name: "Shea Moisture Raw Shea Butter Deep Treatment",
    brand: "Shea Moisture",
    price: 6200,
    category: "skincare",
    image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634451/Shea_Butter_Raw_mte3sa.jpg",
  },
  {
    _id: "staple-toner",
    name: "Oily Skin Toner – Mattifying | Natural Outcome",
    brand: "Natural Outcome",
    price: 5500,
    category: "skincare",
    image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779634629/Mattifying_Skin_Toner_b7z9nr.webp",
  },
  {
    _id: "staple-spf",
    name: "Amaterasun Brightening Sunscreen SPF 50",
    brand: "Amaterasun",
    price: 7200,
    category: "skincare",
    image: "https://res.cloudinary.com/dyzkjerez/image/upload/v1779635060/Brightening_Sunscreen_SPF_50_hsjqtj.avif",
  },
];

function Dashboard({ onCartOpen }) {
  const { user, logout } = useAuth();
  const { addToCart, cartItems } = useCart();
  const cartCount = (cartItems || []).reduce((acc, item) => acc + (item.quantity || 1), 0);
  const { profile, updateProfile, resetProfile } = useBeautyProfile();
  const toastContext = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/products");
    }
  };

  // Tab management: handle query param ?tab=beauty-profile or location.state
  const searchTab = new URLSearchParams(location.search).get("tab");
  const [selectedTab, setSelectedTab] = useState(null);
  const activeTab = selectedTab || location.state?.tab || searchTab || "profile";
  const setActiveTab = (tab) => setSelectedTab(tab);

  // Sub-tabs for Beauty Routine (morning, night, weekly)
  const [routineTab, setRoutineTab] = useState("morning");

  // Profile modal and form state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState(true);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [userAddress, setUserAddress] = useState(DEFAULT_ADDRESS);

  // Password state
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // AI Saved Recommendations state
  const [savedRecommendations, setSavedRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Beauty Profile Quick Editor
  const [isEditingBeautyProfile, setIsEditingBeautyProfile] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const editForm = editFormData || {
    skinType: profile?.skinType || "combination",
    skinConcerns: profile?.skinConcerns || "Hyperpigmentation & Glow",
    hairType: profile?.hairType || "coily",
    budget: profile?.budget || "Moderate (₦10,000–₦25,000)",
  };
  const setEditForm = (updater) => {
    if (typeof updater === "function") {
      setEditFormData((prev) => updater(prev || editForm));
    } else {
      setEditFormData(updater);
    }
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Fetch real orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/api/orders/myorders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("fetchOrders error:", err);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    if (user && (activeTab === "orders" || activeTab === "beauty-profile")) {
      fetchOrders();
    }
  }, [user, activeTab]);

  // Fetch saved AI recommendation sessions
  useEffect(() => {
    const fetchSavedRecs = async () => {
      try {
        setLoadingRecs(true);
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_URL}/api/wishlist/recommendations/saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSavedRecommendations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("fetchSavedRecs error:", err);
      } finally {
        setLoadingRecs(false);
      }
    };

    if (user && activeTab === "beauty-profile") {
      fetchSavedRecs();
    }
  }, [user, activeTab]);

  // Notification helper
  const notify = (msg, type = "success") => {
    if (toastContext?.addToast) {
      toastContext.addToast(msg, type);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 3500);
    }
  };

  const handleProfileSave = async ({ name, email }) => {
    setErrorMsg("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          isAdmin: data.isAdmin,
        }),
      );

      setSuccessMsg("Profile updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Profile save error:", err);
      setErrorMsg(err.message || "Failed to update profile. Please try again.");
      throw err;
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setPasswordSaving(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordData.newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setPasswordSuccess("Password updated successfully!");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err) {
      setPasswordError(err.message || "Failed to update password. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleBuyAgain = (order) => {
    if (order.orderItems && order.orderItems.length > 0) {
      order.orderItems.forEach((item) => addToCart(item));
    } else {
      addToCart({
        _id: order._id,
        name: order.name,
        price: order.totalPrice,
        image: order.image,
      });
    }
    notify("Item re-added to bag!");
    if (onCartOpen) onCartOpen();
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  // ── Beauty Profile Logic ──────────────────────────────
  const skinType = profile?.skinType;
  const currentRoutine = useMemo(() => {
    return getRoutineSteps(skinType || "combination");
  }, [skinType]);

  const activeRoutineSteps = currentRoutine[routineTab] || currentRoutine.morning;

  const totalRoutinePrice = useMemo(() => {
    return activeRoutineSteps.reduce((acc, step) => acc + (step.product?.price || 0), 0);
  }, [activeRoutineSteps]);

  // Detected Skin Tone object
  const toneId = profile?.skinTone?.id;
  const toneLabel = profile?.skinTone?.label;
  const toneHex = profile?.skinTone?.hex;
  const detectedTone = useMemo(() => {
    if (toneId) {
      return (
        SKIN_TONES.find((t) => t.id === toneId) || {
          id: toneId,
          label: toneLabel || "Melanin Tone",
          hex: toneHex || "#B8834A",
          undertone: "Warm Golden / Caramel",
          description: "Detected melanin tone with tailored active formulation guidance.",
        }
      );
    }
    // Default tailored tone for Gracia Fab
    return SKIN_TONES[3]; // Tan / Warm Caramel
  }, [toneId, toneLabel, toneHex]);

  // Replenishment items extracted from past orders or fallback staples
  const emptiesList = useMemo(() => {
    if (orders && orders.length > 0) {
      const items = [];
      const seen = new Set();
      orders.forEach((o) => {
        (o.orderItems || []).forEach((item) => {
          if (item?._id && !seen.has(item._id)) {
            seen.add(item._id);
            items.push(item);
          }
        });
      });
      if (items.length > 0) return items.slice(0, 4);
    }
    return DEFAULT_EMPTIES;
  }, [orders]);

  // Bulk reorder entire routine
  const handleReorderEntireRoutine = () => {
    activeRoutineSteps.forEach((s) => {
      if (s.product) {
        addToCart(s.product);
      }
    });
    const label = routineTab === "morning" ? "Morning" : routineTab === "night" ? "Night" : "Weekly";
    notify(`All ${activeRoutineSteps.length} ${label} routine essentials added to bag! 🛍️`);
    if (onCartOpen) onCartOpen();
  };

  // Add individual step item
  const handleAddStepToBag = (product, stepName) => {
    addToCart(product);
    notify(`Added ${product.name || stepName} to bag!`);
    if (onCartOpen) onCartOpen();
  };

  // Save updated beauty profile
  const handleSaveBeautyProfile = (e) => {
    e.preventDefault();
    updateProfile({
      skinType: editForm.skinType,
      skinConcerns: editForm.skinConcerns,
      hairType: editForm.hairType,
      budget: editForm.budget,
    });
    setIsEditingBeautyProfile(false);
    notify("Beauty profile updated! Regimens tailored. ✨");
  };

  if (!user) return null;

  const firstName = user.name ? user.name.split(" ")[0] : "there";
  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "E";

  return (
    <div className="account-page">
      <SEO
        title="My Beauty Profile & Account | Gracia Fab"
        description="View your AI beauty profile, custom day & night routines, tone matches, orders, and rewards."
        url="/dashboard"
      />

      {/* Account Top Bar with Back Button */}
      <header className="account-topbar">
        <button
          type="button"
          onClick={handleBack}
          className="account-back-btn"
          aria-label="Return to previous page"
          title="Return to previous page"
        >
          <span className="account-back-arrow" aria-hidden="true">←</span>
          <span className="account-back-text">Back to Store</span>
        </button>

        <Link to="/" className="account-logo-link" title="Gracia Fab Home">
          <GraciaLogo size="md" variant="editorial" />
        </Link>

        <div className="account-topbar-right">
          <button
            type="button"
            onClick={onCartOpen}
            className="account-cart-pill"
            aria-label={`Open shopping bag, ${cartCount} items`}
            title="Shopping Bag"
          >
            <span className="cart-icon" aria-hidden="true">🛍️</span>
            <span className="cart-badge">{cartCount}</span>
          </button>
          <div className="account-avatar-badge" title={user.name}>
            {userInitial}
          </div>
        </div>
      </header>

      <h1 className="sr-only">My Account & Beauty Profile</h1>

      {/* Main Account Shell */}
      <div className="account-shell">
        {/* Left Navigation Sidebar */}
        <aside className="account-sidebar">
          <button
            type="button"
            onClick={handleBack}
            className="account-nav-back-link"
            title="Return to previous page"
          >
            ← Continue Shopping
          </button>
          <button
            className={`account-nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Orders
          </button>
          <button
            className={`account-nav-item ${activeTab === "beauty-profile" ? "active" : ""}`}
            onClick={() => setActiveTab("beauty-profile")}
          >
            👑 My Beauty Profile <span className="nav-ai-pill">✦ AI</span>
          </button>
          <button
            className={`account-nav-item ${activeTab === "rewards" ? "active" : ""}`}
            onClick={() => setActiveTab("rewards")}
          >
            ✨ Streak Rewards
          </button>
          <button
            className={`account-nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            className={`account-nav-item ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            🔒 Security
          </button>
        </aside>

        {/* Right Content Area */}
        <main className="account-main">
          {successMsg && <div className="account-alert-success">{successMsg}</div>}
          {errorMsg && <div className="account-alert-error">⚠️ {errorMsg}</div>}

          {/* ══════════════════════════════════════════
              TAB: MY BEAUTY PROFILE HUB
          ══════════════════════════════════════════ */}
          {activeTab === "beauty-profile" && (
            <div className="beauty-hub-view">
              {/* 1. Header Hero Card */}
              <div className="account-card beauty-hub-header-card">
                <div className="beauty-hub-header-meta">
                  <span className="beauty-hub-tag">✦ AI BEAUTY CONCIERGE IDENTITY</span>
                  <h2 className="beauty-hub-title">My Beauty Profile & Daily Rituals</h2>
                  <p className="beauty-hub-desc">
                    Your formulation blueprint tailored for melanin-rich skin, high-humidity climates,
                    and personalized morning & night care regimens.
                  </p>
                </div>

                {/* Profile Attributes Summary Grid */}
                <div className="beauty-profile-summary-grid">
                  <div className="profile-summary-pill">
                    <span className="summary-pill-label">🧴 Skin Type</span>
                    <strong className="summary-pill-val">
                      {profile?.skinType
                        ? profile.skinType.charAt(0).toUpperCase() + profile.skinType.slice(1)
                        : "Combination"}
                    </strong>
                  </div>

                  <div className="profile-summary-pill">
                    <span className="summary-pill-label">🎯 Primary Focus</span>
                    <strong className="summary-pill-val">
                      {profile?.skinConcerns || "Hyperpigmentation & Glow"}
                    </strong>
                  </div>

                  <div className="profile-summary-pill">
                    <span className="summary-pill-label">💇🏽‍♀️ Hair Texture</span>
                    <strong className="summary-pill-val">
                      {profile?.hairType
                        ? profile.hairType.charAt(0).toUpperCase() + profile.hairType.slice(1)
                        : "Coily (4A–4C)"}
                    </strong>
                  </div>

                  <div className="profile-summary-pill">
                    <span className="summary-pill-label">💰 Target Budget</span>
                    <strong className="summary-pill-val">
                      {profile?.budget || "Moderate (₦10k–₦25k)"}
                    </strong>
                  </div>
                </div>

                {/* Profile Actions */}
                <div className="beauty-hub-header-actions">
                  <button
                    type="button"
                    className="beauty-hub-btn-edit"
                    onClick={() => setIsEditingBeautyProfile(!isEditingBeautyProfile)}
                  >
                    {isEditingBeautyProfile ? "✕ Close Editor" : "✏️ Quick Edit Profile"}
                  </button>
                  <Link to="/advisor" className="beauty-hub-btn-advisor">
                    ✦ Open AI Beauty Advisor →
                  </Link>
                  <button
                    type="button"
                    className="beauty-hub-btn-reset"
                    onClick={() => {
                      if (window.confirm("Reset your beauty consultation profile to default?")) {
                        resetProfile();
                        notify("Beauty profile reset to defaults.");
                      }
                    }}
                  >
                    Reset
                  </button>
                </div>

                {/* Expandable Quick Editor */}
                {isEditingBeautyProfile && (
                  <form className="beauty-profile-edit-panel" onSubmit={handleSaveBeautyProfile}>
                    <h4 className="edit-panel-heading">Adjust Your Beauty Attributes</h4>
                    <div className="edit-fields-grid">
                      <div className="edit-form-field">
                        <label>Skin Type</label>
                        <select
                          value={editForm.skinType}
                          onChange={(e) =>
                            setEditForm({ ...editForm, skinType: e.target.value })
                          }
                        >
                          <option value="combination">Combination Skin</option>
                          <option value="oily">Oily Skin</option>
                          <option value="dry">Dry / Dehydrated Skin</option>
                          <option value="sensitive">Sensitive Skin</option>
                          <option value="normal">Balanced / Normal</option>
                        </select>
                      </div>

                      <div className="edit-form-field">
                        <label>Primary Concerns</label>
                        <input
                          type="text"
                          value={editForm.skinConcerns}
                          onChange={(e) =>
                            setEditForm({ ...editForm, skinConcerns: e.target.value })
                          }
                          placeholder="e.g. Dark spots, Acne, Glow"
                        />
                      </div>

                      <div className="edit-form-field">
                        <label>Hair Type / Focus</label>
                        <select
                          value={editForm.hairType}
                          onChange={(e) =>
                            setEditForm({ ...editForm, hairType: e.target.value })
                          }
                        >
                          <option value="coily">Coily (4A, 4B, 4C)</option>
                          <option value="curly">Curly (3A, 3B, 3C)</option>
                          <option value="wavy">Wavy Hair</option>
                          <option value="straight">Straight Hair</option>
                          <option value="wigs">Raw Virgin Wigs & Units</option>
                        </select>
                      </div>

                      <div className="edit-form-field">
                        <label>Budget Level</label>
                        <select
                          value={editForm.budget}
                          onChange={(e) =>
                            setEditForm({ ...editForm, budget: e.target.value })
                          }
                        >
                          <option value="Budget (under ₦10,000/item)">
                            Budget (under ₦10,000/item)
                          </option>
                          <option value="Moderate (₦10,000–₦25,000)">
                            Moderate (₦10,000–₦25,000)
                          </option>
                          <option value="Luxury (₦25,000+)">
                            Luxury / High Performance (₦25,000+)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="edit-panel-actions">
                      <button type="submit" className="edit-panel-save-btn">
                        Save Changes ✦
                      </button>
                      <button
                        type="button"
                        className="edit-panel-cancel-btn"
                        onClick={() => setIsEditingBeautyProfile(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* 2. Detected Skin Tone & Complexion Card */}
              <div className="account-card beauty-tone-match-card">
                <div className="tone-match-content">
                  <div className="tone-swatch-col">
                    <div
                      className="tone-color-circle"
                      style={{ background: detectedTone.hex }}
                      title={detectedTone.label}
                    />
                    <span className="tone-code-label">{detectedTone.label}</span>
                    <span className="tone-undertone-badge">{detectedTone.undertone}</span>
                  </div>

                  <div className="tone-info-col">
                    <div className="tone-info-header">
                      <h3>{detectedTone.emoji} Complexion & Melanin Profile</h3>
                      <Link to="/skin-tone" className="tone-rescan-btn">
                        📸 Retake Selfie Scan →
                      </Link>
                    </div>
                    <p className="tone-desc-text">{detectedTone.description}</p>

                    <div className="tone-tags-row">
                      <span className="tone-tag">Niacinamide</span>
                      <span className="tone-tag">Vitamin C 15%</span>
                      <span className="tone-tag">Invisible SPF 50+</span>
                      <span className="tone-tag">Non-Comedogenic Barrier</span>
                    </div>

                    <div className="tone-actions-row">
                      <Link to="/products?category=makeup" className="tone-match-link">
                        💄 Shop Foundation & Concealer Matches →
                      </Link>
                      <Link to="/compare" className="tone-compare-link">
                        ⚖️ Compare Formulations →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Saved Daily Regimens (AM / PM / Weekly) */}
              <div className="account-card beauty-routine-card">
                <div className="routine-card-header">
                  <div>
                    <span className="routine-card-tag">DAILY BEAUTY RITUALS</span>
                    <h3 className="routine-card-title">Saved Skincare Regimen</h3>
                    <p className="routine-card-sub">
                      Curated specifically for your{" "}
                      <strong>
                        {profile?.skinType
                          ? profile.skinType.charAt(0).toUpperCase() + profile.skinType.slice(1)
                          : "Combination"}
                      </strong>{" "}
                      skin in Nigerian weather conditions.
                    </p>
                  </div>

                  {/* Sub-tab pills */}
                  <div className="routine-subtabs-nav">
                    <button
                      type="button"
                      className={`routine-subtab-btn ${routineTab === "morning" ? "active" : ""}`}
                      onClick={() => setRoutineTab("morning")}
                    >
                      ☀️ Morning ({currentRoutine.morning.length})
                    </button>
                    <button
                      type="button"
                      className={`routine-subtab-btn ${routineTab === "night" ? "active" : ""}`}
                      onClick={() => setRoutineTab("night")}
                    >
                      🌙 Night ({currentRoutine.night.length})
                    </button>
                    <button
                      type="button"
                      className={`routine-subtab-btn ${routineTab === "weekly" ? "active" : ""}`}
                      onClick={() => setRoutineTab("weekly")}
                    >
                      📅 Weekly ({currentRoutine.weekly.length})
                    </button>
                  </div>
                </div>

                {/* Routine Summary & Bulk Reorder Bar */}
                <div className="beauty-routine-summary-bar">
                  <div className="routine-summary-info">
                    <span className="routine-val-label">
                      {routineTab === "morning"
                        ? "☀️ Morning Regimen"
                        : routineTab === "night"
                          ? "🌙 Night Restoration"
                          : "📅 Weekly Treatments"}
                    </span>
                    <span className="routine-val-price">
                      Estimated Investment: <strong>{formatPrice(totalRoutinePrice)}</strong> (
                      {activeRoutineSteps.length} products)
                    </span>
                  </div>

                  <button
                    type="button"
                    className="routine-bulk-reorder-btn"
                    onClick={handleReorderEntireRoutine}
                  >
                    + Reorder Entire Routine ({formatPrice(totalRoutinePrice)})
                  </button>
                </div>

                {/* Steps List */}
                <div className="beauty-steps-list">
                  {activeRoutineSteps.map((stepItem, idx) => (
                    <div key={stepItem.product?._id || idx} className="beauty-step-card">
                      <div className="step-card-num-wrap">
                        <span className="step-card-num">0{idx + 1}</span>
                      </div>

                      <div className="step-card-thumb-wrap">
                        <img
                          src={stepItem.product?.image}
                          alt={stepItem.product?.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/product-placeholder.svg";
                          }}
                        />
                      </div>

                      <div className="step-card-details">
                        <div className="step-card-meta-line">
                          <span className="step-badge-pill">{stepItem.badge}</span>
                          <span className="step-timing-pill">{stepItem.timing}</span>
                        </div>
                        <h4 className="step-card-prod-title">
                          <Link to={`/products/${stepItem.product?._id}`}>
                            {stepItem.product?.name}
                          </Link>
                        </h4>
                        <p className="step-card-instruction">{stepItem.instruction}</p>
                        <div className="step-card-rating">
                          ★ {stepItem.product?.rating || 4.5} · ({stepItem.product?.reviews ?? 0} reviews)
                        </div>
                      </div>

                      <div className="step-card-action-col">
                        <span className="step-card-price">
                          {formatPrice(stepItem.product?.price || 18000)}
                        </span>
                        <button
                          type="button"
                          className="step-card-add-btn"
                          onClick={() => handleAddStepToBag(stepItem.product, stepItem.type)}
                        >
                          + Add to Bag
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="routine-card-footer">
                  <Link to="/routine-generator" className="routine-custom-link">
                    ✨ Generate a Fully Customized Routine in AI Routine Generator →
                  </Link>
                </div>
              </div>

              {/* 4. Previous AI Recommendations History */}
              <div className="account-card beauty-history-card">
                <div className="history-card-header">
                  <div>
                    <span className="history-card-tag">SAVED SESSIONS</span>
                    <h3 className="history-card-title">Previous AI Consultations</h3>
                    <p className="history-card-sub">
                      Past recommendations generated for your profile by the Gracia Fab Beauty Advisor.
                    </p>
                  </div>
                  <Link to="/advisor" className="history-new-consult-btn">
                    ✦ New Consultation
                  </Link>
                </div>

                {loadingRecs ? (
                  <p className="history-empty-text">Loading saved consultations...</p>
                ) : savedRecommendations.length > 0 ? (
                  <div className="history-sessions-list">
                    {savedRecommendations.map((session, sIdx) => (
                      <div key={session._id || sIdx} className="history-session-item">
                        <div className="session-item-header">
                          <span className="session-num-badge">
                            Consultation #{session.number || sIdx + 1}
                          </span>
                          <span className="session-date-text">
                            {session.date ? new Date(session.date).toLocaleDateString() : "Recent"}
                          </span>
                        </div>

                        <div className="session-products-row">
                          {(session.products || []).map((p) => (
                            <div key={p._id || p.name} className="session-prod-tile">
                              <img
                                src={p.image}
                                alt={p.name}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "/product-placeholder.svg";
                                }}
                              />
                              <div className="session-prod-info">
                                <h5>{p.name}</h5>
                                <span className="session-prod-price">
                                  {formatPrice(p.price || 18000)}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="session-prod-add-btn"
                                onClick={() => handleAddStepToBag(p, p.name)}
                              >
                                + Bag
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="history-empty-box">
                    <p className="history-empty-text">
                      No saved consultations yet. You can chat with our AI Beauty Advisor anytime
                      to receive tailored formulations and save them to your account.
                    </p>
                    <Link to="/advisor" className="history-cta-link">
                      Start Your First AI Consultation →
                    </Link>
                  </div>
                )}
              </div>

              {/* 5. Quick Reorder Shortcuts (Empties Replenishment) */}
              <div className="account-card beauty-empties-card">
                <div className="empties-header">
                  <div>
                    <span className="empties-tag">1-CLICK REPLENISHMENT</span>
                    <h3 className="empties-title">🧴 Replenish Your Routine Empties</h3>
                    <p className="empties-sub">
                      Running low? Quick 1-click reorder for your daily staples with same-day Lagos dispatch.
                    </p>
                  </div>
                </div>

                <div className="empties-grid">
                  {emptiesList.map((item) => (
                    <div key={item._id} className="empty-item-tile">
                      <div className="empty-item-img-wrap">
                        <img
                          src={item.image}
                          alt={item.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/product-placeholder.svg";
                          }}
                        />
                      </div>
                      <div className="empty-item-details">
                        <h4 className="empty-item-title">{item.name}</h4>
                        <span className="empty-item-brand">{item.brand || "Gracia Fab"}</span>
                        <div className="empty-item-price-line">
                          <strong className="empty-price">{formatPrice(item.price || 18000)}</strong>
                          <span className="empty-stock-badge">In Stock</span>
                        </div>
                        <span className="empty-delivery-badge">⚡ Express Lagos Delivery</span>
                      </div>
                      <button
                        type="button"
                        className="empty-reorder-btn"
                        onClick={() => handleAddStepToBag(item, item.name)}
                      >
                        ⚡ Replenish & Reorder
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 2: PROFILE (Standard Account View)
          ══════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="profile-view">
              {/* Streak Stars Banner Card */}
              <div className="account-card streak-banner-card">
                <div className="streak-banner-content">
                  <p className="streak-greeting">Hi, {firstName} !</p>
                  <p className="streak-balance">
                    Your current ✨ streak stars balance: <strong>10 ✨</strong>
                  </p>
                  <button
                    type="button"
                    className="streak-view-link"
                    onClick={() => setActiveTab("rewards")}
                  >
                    View your ✨ streak stars →
                  </button>
                </div>
              </div>

              {/* User Personal Info Card */}
              <div className="account-card">
                <div className="account-card-header">
                  <h3>{user.name || "Esther Obisesan"}</h3>
                  <button
                    type="button"
                    className="account-action-btn"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit
                  </button>
                </div>
                <div className="account-field-row">
                  <span className="account-field-label">Email</span>
                  <span className="account-field-val">{user.email}</span>
                </div>
              </div>

              {/* Addresses Card */}
              <div className="account-card">
                <div className="account-card-header">
                  <h3>Addresses</h3>
                  <button
                    type="button"
                    className="account-action-btn"
                    onClick={() => {
                      const newAddr = prompt("Enter delivery address:", userAddress);
                      if (newAddr) setUserAddress(newAddr);
                    }}
                  >
                    Add
                  </button>
                </div>

                <div className="account-address-tile">
                  <span className="account-pin-icon" aria-hidden="true">
                    📍
                  </span>
                  <div className="account-address-info">
                    <p className="account-address-title">
                      {user.name || "Esther Obisesan"}{" "}
                      <span className="account-default-pill">Default</span>
                    </p>
                    <p className="account-address-text">{userAddress}</p>
                  </div>
                  <span className="account-chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
              </div>

              {/* Marketing Preferences Card */}
              <div className="account-card">
                <h3 className="account-card-heading-plain">Marketing preferences</h3>
                <div className="account-toggle-row">
                  <span className="account-toggle-label">
                    <span className="account-mail-icon" aria-hidden="true">
                      ✉
                    </span>{" "}
                    Email
                  </span>
                  <button
                    type="button"
                    className={`account-switch ${marketingEmail ? "on" : "off"}`}
                    onClick={() => setMarketingEmail(!marketingEmail)}
                    aria-label="Toggle marketing email preferences"
                  >
                    <span className="switch-knob">
                      {marketingEmail && <span className="switch-check">✓</span>}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sign Out Actions */}
              <div className="account-signout-row">
                <button
                  type="button"
                  className="account-btn-signout"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  className="account-link-signout-all"
                  onClick={handleLogout}
                >
                  Sign out of all devices
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 3: ORDERS
          ══════════════════════════════════════════ */}
          {activeTab === "orders" && (
            <div className="orders-view">
              {loadingOrders ? (
                <div className="account-card">
                  <p>Loading your orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="account-card">
                  <p>You haven't placed any orders yet.</p>
                  <Link to="/products" className="account-btn-signout" style={{ marginTop: "1rem" }}>
                    Start Shopping →
                  </Link>
                </div>
              ) : (
                <div className="orders-cards-list">
                  {orders.map((order, idx) => {
                    const itemImage =
                      order.orderItems?.[0]?.image ||
                      order.image ||
                      "/product-placeholder.svg";
                    const orderNum = order._id ? order._id.slice(-5) : "16610";

                    return (
                      <div key={order._id || idx} className="account-card order-item-card">
                        <div className="order-item-layout">
                          <div className="order-item-thumb-wrap">
                            <img
                              src={itemImage}
                              alt={order.name || "Order Item"}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/product-placeholder.svg";
                              }}
                            />
                          </div>

                          <div className="order-item-info">
                            <h4 className="order-status-text">
                              {order.status || "On its way"}
                            </h4>
                            <p className="order-meta-text">
                              #{orderNum} · {formatPrice(order.totalPrice || 80000)} NGN
                            </p>
                          </div>

                          <button
                            type="button"
                            className="order-btn-buyagain"
                            onClick={() => handleBuyAgain(order)}
                          >
                            Buy again
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 4: STREAK REWARDS
          ══════════════════════════════════════════ */}
          {activeTab === "rewards" && (
            <div className="rewards-view">
              <LoyaltyWidget />
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 5: SECURITY
          ══════════════════════════════════════════ */}
          {activeTab === "security" && (
            <div className="account-card">
              <div className="account-card-header">
                <h3>Change password</h3>
              </div>

              {passwordSuccess && (
                <div className="account-alert-success">{passwordSuccess}</div>
              )}
              {passwordError && (
                <div className="account-alert-error">⚠️ {passwordError}</div>
              )}

              <form onSubmit={handlePasswordUpdate}>
                <div className="form-group">
                  <label>New password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm new password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Repeat new password"
                  />
                </div>
                <button
                  type="submit"
                  className="account-btn-primary"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Account Bottom Legal Bar */}
      <footer className="account-legal-footer">
        <div className="account-legal-links">
          <span className="account-region-select">Nigeria ⌄</span>
          <Link to="/">Refund policy</Link>
          <Link to="/">Shipping</Link>
          <Link to="/">Privacy policy</Link>
          <Link to="/">Terms of service</Link>
          <Link to="/contact">Contact information</Link>
        </div>
      </footer>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
        onSave={handleProfileSave}
      />
    </div>
  );
}

export default Dashboard;
