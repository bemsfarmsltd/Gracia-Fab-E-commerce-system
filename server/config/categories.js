// The starter list, written once into an empty database. After that the
// owner manages categories in the admin (add, rename, reorder, hide), so
// changing this list doesn't touch a live shop.
//
// Department slugs skincare, haircare, wig and bridal are the ones the shop
// has always used (home page links, AI advisor, My Vanity): keep them.
export const DEFAULT_CATEGORIES = [
  {
    slug: "skincare",
    name: "Skincare",
    children: [
      "Face wash & cleansers",
      "Toners",
      "Serums",
      "Face creams & moisturisers",
      "Sunscreen",
      "Face masks",
      "Spot & dark-mark treatments",
    ],
  },
  {
    slug: "bodycare",
    name: "Body care",
    children: [
      "Body wash & shower gel",
      "Bar soaps",
      "Body lotions & creams",
      "Tube creams",
      "Body oils",
      "Body butters",
      "Body scrubs",
    ],
  },
  {
    slug: "haircare",
    name: "Haircare",
    children: [
      "Shampoos",
      "Conditioners",
      "Hair creams",
      "Hair relaxers",
      "Hair oils",
      "Hair treatments & masks",
      "Styling (gels, edge control)",
    ],
  },
  {
    slug: "fragrance",
    name: "Fragrance",
    children: ["Perfumes", "Body mists", "Deodorants & roll-ons"],
  },
  {
    slug: "wig",
    name: "Wigs",
    children: ["Human hair wigs", "Synthetic wigs", "Wig care"],
  },
  {
    slug: "bridal",
    name: "Bridal",
    children: [],
  },
];
