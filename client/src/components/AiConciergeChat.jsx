import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/useToast";
import API_URL from "../config";
import "./AiConciergeChat.css";

const QUICK_PROMPTS = [
  "✨ Recommend skincare for dark spots",
  "👑 Which wig suits a beginner?",
  "🏪 Where is your store and when are you open?",
  "🌸 How much is delivery?",
  "👰🏽 Help me prepare for my wedding",
];

// Offline answers (used when the AI can't be reached). Facts only from the
// owner: store in Umuahia North, open Mon-Sat 8am-6pm, salon, wig installs, bridal
// makeup and accessories, consultations with the MD. Order matters: the first
// matching entry answers.
const KNOWLEDGE_BASE = [
  {
    keywords: ["book", "booking", "appointment", "reserve", "schedule"],
    reply: "You can book a hairstyle, wig install, bridal makeup or a consultation with our MD on **WhatsApp** or by phone on **0803 744 7068**. If we haven't replied on WhatsApp within 30 minutes, please call. We're open **Monday to Saturday, 8am to 6pm**.",
    link: { text: "Book an appointment →", url: "/contact" },
  },
  {
    keywords: ["store", "shop", "visit", "open", "hours", "close", "salon", "hairstyle", "braid", "install", "makeup", "make-up", "consult", "located", "location", "address", "where are you"],
    reply: "Our store is in **Umuahia North, Umuahia, Abia State**, open **Monday to Saturday, 8am to 6pm**. In store we sell beauty, skin and hair products, do hairstyles and wig installs in our salon, offer bridal makeup and accessories, and our MD gives consultations on skin, hair and wig problems.",
    link: { text: "About our store →", url: "/about" },
  },
  {
    keywords: ["hyperpigmentation", "dark spot", "vitamin c", "serum", "brighten", "even skin", "uneven"],
    reply: "For dark spots and uneven tone, look at serums with vitamin C or niacinamide, and wear sunscreen every day. The AI Beauty Advisor can suggest products from our shelves for your skin.",
    link: { text: "Ask the AI Beauty Advisor →", url: "/recommend" },
  },
  {
    keywords: ["wig", "frontal", "closure", "glueless", "bone straight", "lace"],
    reply: "We keep a small range of wigs. Each wig's page describes its hair, length and lace. If you'd like it installed, our salon in Umuahia does wig installs.",
    link: { text: "See our wigs →", url: "/products?category=wig" },
  },
  {
    keywords: ["delivery", "deliver", "shipping", "ship", "lagos", "abuja", "nationwide", "dispatch", "monnify", "payment", "pay", "how much"],
    reply: "We deliver to all 36 states and the FCT for a flat **₦2,500**, sent from our store in Umuahia. You can pay by card, bank transfer or USSD through Monnify. Delivery time depends on where you are; see Shipping & Returns.",
    link: { text: "Shipping & Returns →", url: "/shipping-returns" },
  },
  {
    keywords: ["undertone", "shade", "skin tone", "detector", "complexion"],
    reply: "Try the **Skin Tone Scan** with your phone camera or a photo. It estimates whether your undertone is Warm Golden, Rich Neutral or Deep Espresso. It runs on your device and doesn't save the photo.",
    link: { text: "Open the Skin Tone Scan →", url: "/skin-tone" },
  },
  {
    keywords: ["bridal", "wedding", "bride", "glam"],
    reply: "Start your bridal skincare routine about 6–8 weeks before the wedding; our bridal guide has a timeline. Our staff also do bridal makeup at our Umuahia store, and we sell bridal accessories. Add your wedding date in My Vanity for a countdown.",
    link: { text: "Read the bridal guide →", url: "/beauty/bridal-skincare-routine-nigeria" },
  },
];

const INITIAL_MESSAGES = [
  {
    sender: "ai",
    text: "Hello! I'm the Gracia Fab assistant. Ask me about skincare, hair products, wigs, bridal beauty, delivery or our store in Umuahia.",
  },
];

function AiConciergeChat({ onCartOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { addToCart } = useCart();
  const { addToast } = useToast();

  // Scroll to bottom on new message or when typing indicator appears
  useEffect(() => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Focus input when conversation is started and chat is open
  useEffect(() => {
    if (isOpen && hasStarted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, hasStarted]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleAddToCart = useCallback(
    (product) => {
      if (!product) return;
      addToCart({
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
      });
      if (addToast) {
        addToast(`Added "${product.name}" to your bag`, "cart");
      }
      if (onCartOpen) {
        onCartOpen();
      }
    },
    [addToCart, addToast, onCartOpen]
  );

  const handleResetChat = () => {
    setMessages(INITIAL_MESSAGES);
    setInputVal("");
    setIsTyping(false);
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isTyping) return;

    // Add user message
    const userMsg = { sender: "user", text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputVal("");
    setIsTyping(true);
    setHasPrompted(false);

    try {
      // Prepare multi-turn history for backend
      const history = nextMessages.slice(-8).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: data.reply,
            products: Array.isArray(data.products) ? data.products : [],
          },
        ]);
        setIsTyping(false);
        return;
      }
      throw new Error("Empty reply");
    } catch {
      // Graceful offline fallback using KNOWLEDGE_BASE keyword matching
      const lower = text.toLowerCase();
      let match = KNOWLEDGE_BASE.find((k) =>
        k.keywords.some((w) => lower.includes(w))
      );

      if (!match) {
        match = {
          reply:
            "I can help with skincare, hair products, wigs, bridal beauty, delivery and our store in Umuahia (open Monday to Saturday, 8am to 6pm). Try asking about one of those, or message us on WhatsApp from the link at the bottom of the page.",
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: match.reply,
          link: match.link,
        },
      ]);
      setIsTyping(false);
    }
  };

  // Helper to safely render bold text (**bold**) and linebreaks
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={lIdx} className="ysl-chat-line">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
          {lIdx < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <>
      {/* ── Floating Chat Button (Bottom-Right) ── */}
      {!isOpen && (
        <div className="ysl-floating-chat-container">
          {hasPrompted && (
            <div
              className="ysl-floating-badge"
              onClick={() => setIsOpen(true)}
              role="button"
              tabIndex={0}
            >
              <span>✦ Ask AI Concierge</span>
            </div>
          )}
          <button
            className="ysl-floating-chat-bubble"
            onClick={() => {
              setIsOpen(true);
              setHasPrompted(false);
            }}
            aria-label="Open Gracia Fab AI Concierge Chat"
            title="Chat with Gracia Fab AI Concierge"
          >
            <span className="ysl-bubble-sparkle">✦</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Chat Widget Modal ── */}
      {isOpen && (
        <aside
          className="ysl-chat-modal"
          role="dialog"
          aria-label="Gracia Fab AI Concierge Chat"
          aria-modal="true"
        >
          {/* Header */}
          <div className="ysl-chat-header">
            <div className="ysl-chat-header-left">
              <span className="ysl-chat-gold-mark">✦</span>
              <div className="ysl-chat-title-group">
                <span className="ysl-chat-title">AI Beauty Concierge</span>
                <span className="ysl-chat-subtitle">Gracia Fab · Umuahia</span>
              </div>
            </div>
            <div className="ysl-chat-header-actions">
              {hasStarted && (
                <button
                  type="button"
                  className="ysl-chat-action-btn"
                  onClick={handleResetChat}
                  aria-label="New conversation"
                  title="New Conversation"
                >
                  ↻
                </button>
              )}
              <button
                type="button"
                className="ysl-chat-action-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize Chat"
                title="Minimize"
              >
                ⌄
              </button>
              <button
                type="button"
                className="ysl-chat-action-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close Chat"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Screen 1: Disclaimer & Hero Consultation View ── */}
          {!hasStarted ? (
            <div className="ysl-chat-intro-view">
              <div className="ysl-chat-hero-img-wrap">
                <img
                  src="/logo.png"
                  alt="Gracia Fab"
                  className="ysl-chat-hero-img"
                />
                <div className="ysl-chat-hero-badge">
                  <span>✦ GRACIA FAB ASSISTANT</span>
                </div>
              </div>

              <div className="ysl-chat-intro-content">
                <div className="ysl-chat-intro-text">
                  <h3>Personalized Beauty Concierge</h3>
                  <p className="ysl-chat-disclaimer">
                    You are speaking with Gracia Fab's AI advisor. It helps with skincare, hair products, wigs, undertones, bridal beauty and questions about our store. By continuing, you agree to our{" "}
                    <Link to="/terms">Terms of Use</Link> and{" "}
                    <Link to="/privacy">Privacy Policy</Link>.
                  </p>
                </div>

                <button
                  type="button"
                  className="ysl-chat-start-btn"
                  onClick={() => setHasStarted(true)}
                >
                  Start Consultation <span>→</span>
                </button>
              </div>
            </div>
          ) : (
            /* ── Screen 2: Interactive AI Chat Conversation ── */
            <div className="ysl-chat-active-view">
              <div className="ysl-chat-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`ysl-chat-bubble-wrap ${
                      msg.sender === "user" ? "user" : "ai"
                    }`}
                  >
                    <div className="ysl-chat-bubble">
                      <div className="ysl-chat-text-content">
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Product Recommendations from live catalog */}
                      {Array.isArray(msg.products) && msg.products.length > 0 && (
                        <div className="ysl-chat-products-list">
                          {msg.products.map((prod) => (
                            <div key={prod._id} className="ysl-chat-product-card">
                              <Link
                                to={`/products/${prod._id}`}
                                className="ysl-chat-prod-link"
                                onClick={() => setIsOpen(false)}
                              >
                                <img
                                  src={
                                    prod.image ||
                                    "/product-placeholder.svg"
                                  }
                                  alt={prod.name}
                                  className="ysl-chat-prod-img"
                                  onError={(e) => {
                                    e.target.src =
                                      "/product-placeholder.svg";
                                  }}
                                />
                              </Link>
                              <div className="ysl-chat-prod-info">
                                <Link
                                  to={`/products/${prod._id}`}
                                  className="ysl-chat-prod-title"
                                  onClick={() => setIsOpen(false)}
                                >
                                  <strong>{prod.name}</strong>
                                </Link>
                                <span className="ysl-chat-prod-price">
                                  ₦{Number(prod.price || 0).toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  className="ysl-chat-add-btn"
                                  onClick={() => handleAddToCart(prod)}
                                >
                                  + Add to Bag
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fallback Quick Link */}
                      {msg.link && (
                        <Link
                          to={msg.link.url}
                          className="ysl-chat-link-btn"
                          onClick={() => setIsOpen(false)}
                        >
                          {msg.link.text}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="ysl-chat-bubble-wrap ai">
                    <div className="ysl-chat-bubble ysl-typing-dots">
                      <span>•</span>
                      <span>•</span>
                      <span>•</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="ysl-chat-quick-chips">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="ysl-quick-chip"
                    onClick={() => handleSend(prompt.replace(/^[^\w]+/, ""))}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="ysl-chat-input-bar"
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask about skincare, wigs, undertones..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="ysl-chat-input"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  className="ysl-chat-send-btn"
                  aria-label="Send message"
                  disabled={!inputVal.trim() || isTyping}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </aside>
      )}
    </>
  );
}

export default AiConciergeChat;