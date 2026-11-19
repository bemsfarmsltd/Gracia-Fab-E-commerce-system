import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import API_URL from "../config";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/useToast";
import { useBeautyProfile } from "../hooks/useBeautyProfile";
import { greeting, profileFromDevice, todayInNigeria, longDate, shortDate, countdownText } from "../utils/vanity";
import "../styles/MyVanity.css";

// My Vanity: the signed-in customer's private home. Everything on it comes
// from their own account (GET /api/vanity) and real, in-stock products.
// Layout and structure are here; the visual design is Antigravity's
// (docs/MY_VANITY_BRIEF.md).

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
async function fetchVanity() {
  const res = await fetch(`${API_URL}/api/vanity`, { headers: authHeaders() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Couldn't load your Vanity");
  return body;
}
const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const PLACEHOLDER = "/product-placeholder.svg";

const ORDER_STEPS = [
  ["paid", "Paid"],
  ["processing", "Being prepared"],
  ["shipped", "On its way"],
  ["delivered", "Delivered"],
];

const LABELS = {
  skinType: "Skin type",
  hairType: "Hair type",
  skinConcerns: "Skin concerns",
  shoppingFor: "Shopping for",
  undertone: "Undertone",
  weddingDate: "Wedding date",
};
const SHOPPING_LABEL = { skincare: "Skincare", haircare: "Haircare", wig: "Wigs", bridal: "Bridal" };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function ProductTile({ p, note, onAdd }) {
  return (
    <li className="vanity-product">
      <Link to={`/products/${p._id}`} className="vanity-product-link">
        <div className="vanity-product-img-wrap">
          <img
            src={p.image || PLACEHOLDER}
            alt={p.name}
            loading="lazy"
            width="160"
            height="160"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
          />
        </div>
        <div className="vanity-product-meta">
          <span className="vanity-product-brand">{p.brand}</span>
          <span className="vanity-product-name">{p.name}</span>
        </div>
      </Link>
      {note && <span className="vanity-product-note">{note}</span>}
      <div className="vanity-product-footer">
        <span className="vanity-product-price">{naira(p.price)}</span>
        {p.inStock ? (
          <>
            {p.lowStock && <span className="vanity-stock-low">Only a few left</span>}
            <button type="button" className="vanity-btn vanity-btn-small" onClick={() => onAdd(p)}>
              Add to bag
            </button>
          </>
        ) : (
          <span className="vanity-stock-out">Out of stock</span>
        )}
      </div>
    </li>
  );
}

function ProfileEditor({ profile, options, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(profile);
  const toggle = (key, value) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value] }));
  const choose = (key, value) => setDraft((d) => ({ ...d, [key]: d[key] === value ? null : value }));

  const single = (key, values, label) => (
    <fieldset className="vanity-fieldset">
      <legend>{label}</legend>
      <div className="vanity-chips">
        {values.map((v) => (
          <button key={v} type="button" className="vanity-chip" aria-pressed={draft[key] === v} onClick={() => choose(key, v)}>
            {cap(v)}
          </button>
        ))}
      </div>
    </fieldset>
  );
  const multi = (key, values, label) => (
    <fieldset className="vanity-fieldset">
      <legend>{label}</legend>
      <div className="vanity-chips">
        {values.map(({ id, label: l }) => (
          <button key={id} type="button" className="vanity-chip" aria-pressed={draft[key].includes(id)} onClick={() => toggle(key, id)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form
      className="vanity-profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        const answers = { ...draft, undertone: draft.undertone?.trim() || null, weddingDate: draft.weddingDate || null };
        delete answers.updatedAt;
        onSave(answers);
      }}
    >
      <p className="vanity-muted">Every question is optional. Only you can see your answers.</p>
      {single("skinType", options.skinTypes, "Skin type")}
      {multi("skinConcerns", options.skinConcerns, "Skin concerns")}
      {single("hairType", options.hairTypes, "Hair type")}
      {multi("hairConcerns", options.hairConcerns, "Hair concerns")}
      {multi("shoppingFor", options.shoppingFor.map((id) => ({ id, label: SHOPPING_LABEL[id] || id })), "I'm shopping for")}
      {single("budget", options.budgets, "Budget per product")}
      <label className="vanity-field">
        <span>Undertone</span>
        <input
          type="text"
          maxLength={60}
          value={draft.undertone || ""}
          placeholder="e.g. Warm Golden / Caramel"
          onChange={(e) => setDraft((d) => ({ ...d, undertone: e.target.value }))}
        />
        <Link to="/skin-tone" className="vanity-inline-link">Find mine with the skin tone scan</Link>
      </label>
      <div className="vanity-field">
        <label htmlFor="vanity-wedding-date"><span>Wedding date (optional)</span></label>
        <input
          id="vanity-wedding-date"
          type="date"
          min={todayInNigeria()}
          value={draft.weddingDate || ""}
          aria-describedby="vanity-wedding-hint"
          onChange={(e) => setDraft((d) => ({ ...d, weddingDate: e.target.value || null }))}
        />
        <p id="vanity-wedding-hint" className="vanity-muted vanity-small vanity-hint">
          Getting married? Add the date for a bridal countdown. Leave it empty if not.
        </p>
      </div>
      <div className="vanity-actions">
        <button type="submit" className="vanity-btn" disabled={saving}>{saving ? "Saving…" : "Save my profile"}</button>
        <button type="button" className="vanity-btn vanity-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function MyVanity({ onCartOpen }) {
  const { addToCart } = useCart();
  const { addToast } = useToast();
  const { profile: deviceProfile } = useBeautyProfile() || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importDismissed, setImportDismissed] = useState(() => {
    try { return localStorage.getItem("vanityImportDismissed") === "1"; } catch { return false; }
  });

  const load = useCallback(async () => {
    try {
      setData(await fetchVanity());
      setError("");
    } catch (err) {
      setError(err.message || "Couldn't load your Vanity");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchVanity()
      .then((body) => active && setData(body))
      .catch((err) => active && setError(err.message || "Couldn't load your Vanity"));
    return () => { active = false; };
  }, []);

  const saveProfile = async (answers) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/vanity/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(answers),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Couldn't save");
      setEditing(false);
      addToast("Your beauty profile is saved", "success");
      await load(); // picks depend on the answers
    } catch (err) {
      addToast(err.message || "Couldn't save your profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const clearProfile = async () => {
    if (!window.confirm("Delete all your beauty profile answers? This can't be undone.")) return;
    const res = await fetch(`${API_URL}/api/vanity/profile`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) {
      addToast("Your beauty profile answers were deleted", "success");
      await load();
    } else {
      addToast("Couldn't delete your answers. Please try again.", "error");
    }
  };

  // Open the profile editor and bring it into view (it sits lower on the page).
  const openEditor = () => {
    setEditing(true);
    requestAnimationFrame(() =>
      document.getElementById("vanity-profile-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
    );
  };

  const addToBag = (p) => {
    addToCart({ _id: p._id, name: p.name, price: p.price, image: p.image });
    addToast(`Added "${p.name}" to your bag`, "cart");
    onCartOpen?.();
  };

  const deviceAnswers = useMemo(() => profileFromDevice(deviceProfile, data?.options), [deviceProfile, data?.options]);
  const offerImport = data && !importDismissed && data.completeness.done === 0 && Object.keys(deviceAnswers).length > 0;
  const dismissImport = () => {
    setImportDismissed(true);
    try { localStorage.setItem("vanityImportDismissed", "1"); } catch { /* private mode */ }
  };

  if (error) {
    return (
      <>
        <Navbar onCartOpen={onCartOpen} />
        <main className="vanity-page vanity-center">
          <p role="alert">{error}</p>
          <button type="button" className="vanity-btn" onClick={load}>Try again</button>
        </main>
        <Footer />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Navbar onCartOpen={onCartOpen} />
        <main className="vanity-page vanity-center" aria-busy="true">
          <p>Opening your Vanity…</p>
        </main>
      </>
    );
  }

  const { profile, completeness, options, picks, activeOrders, restock, wishlist, recentlyViewed, savedRoutine, loyalty, bridal } = data;
  const conLabel = (list, id) => list.find((c) => c.id === id)?.label || id;
  const summary = [
    ["skinType", cap(profile.skinType)],
    ["hairType", cap(profile.hairType)],
    ["skinConcerns", profile.skinConcerns.map((id) => conLabel(options.skinConcerns, id)).join(", ")],
    ["shoppingFor", profile.shoppingFor.map((id) => SHOPPING_LABEL[id] || id).join(", ")],
    ["undertone", profile.undertone],
    ...(profile.weddingDate ? [["weddingDate", longDate(profile.weddingDate)]] : []),
  ];
  const tierProgress = loyalty.nextTierAt ? Math.min(100, Math.round((loyalty.totalEarned / loyalty.nextTierAt) * 100)) : 100;

  return (
    <>
      <SEO title="My Vanity" description="Your private Gracia Fab beauty space." url="/my-vanity" />
      <Navbar onCartOpen={onCartOpen} />
      <main className="vanity-page">
        <header className="vanity-hero">
          <p className="vanity-eyebrow">My Vanity</p>
          <h1>
            {greeting()}{data.firstName ? `, ${data.firstName}` : ""}
          </h1>
          <p className="vanity-muted">Your private beauty space. Only you can see this page.</p>
          <div className="vanity-progress" aria-label={`Beauty profile ${completeness.done} of ${completeness.total} complete`}>
            <div className="vanity-progress-bar" style={{ width: `${(completeness.done / completeness.total) * 100}%` }} />
          </div>
          <p className="vanity-muted vanity-small">
            Beauty profile: {completeness.done} of {completeness.total}
            {completeness.done < completeness.total && " · the more you share, the better your picks"}
          </p>
        </header>

        {bridal && (
          <section className="vanity-card vanity-bridal" aria-labelledby="vanity-bridal-title">
            <div className="vanity-card-head">
              <h2 id="vanity-bridal-title">Your wedding countdown</h2>
              <button type="button" className="vanity-inline-link vanity-link-btn" onClick={openEditor}>
                Change date
              </button>
            </div>
            <p className="vanity-bridal-days" aria-live="polite">{countdownText(bridal.daysLeft)}</p>
            <p className="vanity-muted">{longDate(bridal.weddingDate)}</p>
            <ol className="vanity-timeline">
              {bridal.milestones.map((m) => (
                <li
                  key={m.key}
                  className={`vanity-timeline-item is-${m.status}`}
                  aria-current={m.status === "next" || m.status === "today" ? "step" : undefined}
                >
                  <span className="vanity-timeline-date">{m.status === "today" ? "Today" : shortDate(m.date)}</span>
                  <span className="vanity-timeline-label">
                    {m.label}
                    {m.status === "past" && <span className="sr-only"> (date passed)</span>}
                  </span>
                  <span className="vanity-muted vanity-small">{m.tip}</span>
                </li>
              ))}
            </ol>
            {bridal.products.length > 0 && (
              <>
                <h3 className="vanity-subhead">For your big day</h3>
                <ul className="vanity-products">
                  {bridal.products.map((p) => <ProductTile key={p._id} p={p} onAdd={addToBag} />)}
                </ul>
              </>
            )}
            <Link to="/beauty/bridal-skincare-routine-nigeria" className="vanity-inline-link">
              Read the full bridal skincare guide
            </Link>
          </section>
        )}

        {!bridal && !editing && profile.shoppingFor.includes("bridal") && (
          <section className="vanity-card vanity-bridal-invite" aria-labelledby="vanity-bridal-invite-title">
            <h2 id="vanity-bridal-invite-title">Getting married?</h2>
            <p className="vanity-muted">Add your wedding date for a countdown with a bridal beauty timeline.</p>
            <button type="button" className="vanity-btn vanity-btn-small" onClick={openEditor}>
              Add my wedding date
            </button>
          </section>
        )}

        {offerImport && (
          <section className="vanity-card vanity-import" aria-labelledby="vanity-import-title">
            <h2 id="vanity-import-title">Use your answers from the beauty tools?</h2>
            <p className="vanity-muted">
              We found answers you gave our AI tools on this device. Add them to your profile so your picks follow you on any phone?
            </p>
            <div className="vanity-actions">
              <button type="button" className="vanity-btn" onClick={async () => { await saveProfile(deviceAnswers); dismissImport(); }}>
                Add them
              </button>
              <button type="button" className="vanity-btn vanity-btn-ghost" onClick={dismissImport}>No thanks</button>
            </div>
          </section>
        )}

        <section className="vanity-card vanity-profile" aria-labelledby="vanity-profile-title">
          <div className="vanity-card-head">
            <h2 id="vanity-profile-title">My beauty profile</h2>
            {!editing && (
              <button type="button" className="vanity-btn vanity-btn-ghost vanity-btn-small" onClick={() => setEditing(true)}>
                {completeness.done ? "Edit" : "Start"}
              </button>
            )}
          </div>
          {editing ? (
            <ProfileEditor profile={profile} options={options} saving={saving} onSave={saveProfile} onCancel={() => setEditing(false)} />
          ) : (
            <dl className="vanity-profile-list">
              {summary.map(([key, value]) => (
                <div key={key}>
                  <dt>{LABELS[key]}</dt>
                  <dd>{value || <span className="vanity-muted">Not set</span>}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {activeOrders.length > 0 && (
          <section className="vanity-card" aria-labelledby="vanity-orders-title">
            <div className="vanity-card-head">
              <h2 id="vanity-orders-title">On its way</h2>
              <Link to="/my-orders" className="vanity-inline-link">All orders</Link>
            </div>
            <ul className="vanity-orders">
              {activeOrders.map((o) => {
                const reached = ORDER_STEPS.findIndex(([s]) => s === o.status);
                return (
                  <li key={o._id} className="vanity-order">
                    <p>
                      <strong>Order #{String(o._id).slice(-6).toUpperCase()}</strong> · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {naira(o.totalPrice)}
                    </p>
                    {o.status === "pending" ? (
                      <p className="vanity-order-pending">
                        Waiting for payment. <Link to="/my-orders">Complete payment</Link>
                      </p>
                    ) : (
                      <ol className="vanity-steps">
                        {ORDER_STEPS.map(([s, label], i) => (
                          <li key={s} className={i <= reached ? "done" : ""} aria-current={i === reached ? "step" : undefined}>
                            {label}
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {picks.items.length > 0 && (
          <section className="vanity-card" aria-labelledby="vanity-picks-title">
            <div className="vanity-card-head">
              <h2 id="vanity-picks-title">{picks.basis === "profile" ? "Picked for you" : "New in store"}</h2>
              {picks.basis !== "profile" && (
                <button type="button" className="vanity-inline-link vanity-link-btn" onClick={() => setEditing(true)}>
                  Fill in your profile for personal picks
                </button>
              )}
            </div>
            <ul className="vanity-products">
              {picks.items.map((p) => (
                <ProductTile key={p._id} p={p} note={picks.basis === "profile" ? p.reasons.join(" · ") : null} onAdd={addToBag} />
              ))}
            </ul>
          </section>
        )}

        {restock.length > 0 && (
          <section className="vanity-card" aria-labelledby="vanity-restock-title">
            <h2 id="vanity-restock-title">Time to restock?</h2>
            <ul className="vanity-products">
              {restock.map((p) => (
                <ProductTile
                  key={p._id}
                  p={p}
                  note={`You bought this on ${new Date(p.lastBought).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
                  onAdd={addToBag}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="vanity-card" aria-labelledby="vanity-routine-title">
          <h2 id="vanity-routine-title">My routine</h2>
          {savedRoutine ? (
            <>
              <p className="vanity-muted vanity-small">
                Saved from the AI Advisor on {new Date(savedRoutine.date).toLocaleDateString("en-NG", { day: "numeric", month: "long" })}
              </p>
              <ul className="vanity-products">
                {savedRoutine.products.map((p) => <ProductTile key={p._id} p={p} onAdd={addToBag} />)}
              </ul>
            </>
          ) : (
            <p className="vanity-muted">
              No routine saved yet. <Link to="/routine-generator">Build a morning and evening routine</Link> or{" "}
              <Link to="/recommend">ask the AI Advisor</Link>, then save it here.
            </p>
          )}
        </section>

        <section className="vanity-card" aria-labelledby="vanity-wishlist-title">
          <div className="vanity-card-head">
            <h2 id="vanity-wishlist-title">My wishlist{wishlist.count ? ` (${wishlist.count})` : ""}</h2>
            {wishlist.count > 0 && <Link to="/wishlist" className="vanity-inline-link">See all</Link>}
          </div>
          {wishlist.count ? (
            <ul className="vanity-products">
              {wishlist.items.map((p) => <ProductTile key={p._id} p={p} onAdd={addToBag} />)}
            </ul>
          ) : (
            <p className="vanity-muted">Tap the heart on any product to keep it here.</p>
          )}
        </section>

        {recentlyViewed.length > 0 && (
          <section className="vanity-card" aria-labelledby="vanity-viewed-title">
            <h2 id="vanity-viewed-title">Recently viewed</h2>
            <ul className="vanity-products">
              {recentlyViewed.map((p) => <ProductTile key={p._id} p={p} onAdd={addToBag} />)}
            </ul>
          </section>
        )}

        <section className="vanity-card" aria-labelledby="vanity-rewards-title">
          <h2 id="vanity-rewards-title">My rewards</h2>
          <p>
            <strong>{loyalty.points.toLocaleString("en-NG")} points</strong> · {cap(loyalty.tier)} member
          </p>
          {loyalty.nextTier ? (
            <>
              <div className="vanity-progress" aria-label={`${loyalty.pointsToNext} points to ${loyalty.nextTier}`}>
                <div className="vanity-progress-bar" style={{ width: `${tierProgress}%` }} />
              </div>
              <p className="vanity-muted vanity-small">{loyalty.pointsToNext.toLocaleString("en-NG")} points to {cap(loyalty.nextTier)}</p>
            </>
          ) : (
            <p className="vanity-muted vanity-small">You're at our top tier.</p>
          )}
          <Link to="/dashboard" className="vanity-inline-link">Rewards and account settings</Link>
        </section>

        <section className="vanity-privacy" aria-label="Privacy">
          <p className="vanity-muted vanity-small">
            Your Vanity is private: only you can see it. We save your scan results, not your photos.
          </p>
          {completeness.done > 0 && (
            <button type="button" className="vanity-link-btn vanity-small" onClick={clearProfile}>
              Delete my beauty profile answers
            </button>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

export default MyVanity;
