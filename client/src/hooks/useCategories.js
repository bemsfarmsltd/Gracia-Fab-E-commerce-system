import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../config";

// Departments and the categories inside them, as the owner set them up in
// the admin Categories screen. The shop gets the visible ones from
// /api/categories; the admin (pass { admin: true }) gets every one, hidden
// too, with product counts.
//
// tree: [{ slug, name, active, children: [{ slug, name, active }] }]

// Before the list arrives (or if it can't load), the departments the shop
// has always had, so filters and labels still work.
export const FALLBACK_TREE = [
  { slug: "skincare", name: "Skincare", children: [] },
  { slug: "haircare", name: "Haircare", children: [] },
  { slug: "wig", name: "Wigs", children: [] },
  { slug: "bridal", name: "Bridal", children: [] },
];

let shopCache = null; // one request per page load for the shop list

async function load(admin) {
  const res = await fetch(`${API_URL}${admin ? "/api/admin/categories" : "/api/categories"}`, {
    headers: admin ? { Authorization: `Bearer ${localStorage.getItem("token")}` } : {},
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error(data?.message || "Couldn't load categories");
  return data;
}

// "serums" → "Serums"; unknown slugs read sensibly ("body-oils" → "Body oils").
export function makeLabeller(tree) {
  const names = new Map();
  for (const d of tree) {
    names.set(d.slug, d.name);
    for (const c of d.children || []) names.set(c.slug, c.name);
  }
  return (slug) => {
    if (!slug) return "";
    if (names.has(slug)) return names.get(slug);
    const words = String(slug).replace(/-/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
}

export function useCategories({ admin = false } = {}) {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      if (!admin) {
        shopCache = shopCache || load(false);
        setTree(await shopCache);
      } else {
        setTree(await load(true));
      }
      setError("");
    } catch (err) {
      if (!admin) shopCache = null;
      setError(err.message);
    }
  }, [admin]);

  useEffect(() => {
    // Fetch-orchestration effect: reload only sets state after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const shown = tree || FALLBACK_TREE;
  const labelFor = useMemo(() => makeLabeller(shown), [shown]);
  return { tree: shown, loaded: Boolean(tree), error, reload, labelFor };
}

// After the owner changes categories, the shop list in this tab is stale.
export const forgetShopCategories = () => {
  shopCache = null;
};
