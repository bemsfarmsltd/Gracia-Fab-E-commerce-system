// The admin portal's first-sign-in tour. It points at menu items, so it
// adapts to the person: steps for sections their role can't see are skipped
// automatically (the target isn't on the page). On phones the menu drawer is
// opened for the tour.
export const adminTourKey = (user) => `gf-tour-admin-v1-${user?._id || "me"}`;
const nav = (id) => `[data-tour="nav-${id}"]`;

export const adminSteps = (user) => {
  const first = (user?.name || "").split(" ")[0];
  const owner = Boolean(user?.isAdmin);
  return [
    {
      id: "welcome",
      eyebrow: owner ? "Your store, in one place" : "Staff portal",
      image: "/icons/admin-icon-192.png",
      title: first ? `Welcome, ${first}` : "Welcome",
      body: owner ? (
        <>
          <p>This is where you run Gracia Fab: online orders, the shop till, stock, suppliers, staff and your figures.</p>
          <p>Here's a two-minute walk through the main parts.</p>
        </>
      ) : (
        <p>This is where you'll pack orders, sell at the till, count stock and handle bookings. Here's a quick look around.</p>
      ),
    },
    {
      id: "menu",
      target: ['[data-tour="admin-nav"]'],
      placement: "right",
      title: "Everything is in the menu",
      body: <p>Sections are grouped: the store, customers, figures, and in-store. {owner ? "Staff only see the parts you allow them." : "You'll only see the parts the owner has given you."}</p>,
    },
    {
      id: "overview",
      target: nav("overview"),
      placement: "right",
      title: "Your overview",
      body: <p>Revenue for the last 30 days and the last week, orders waiting at each stage, and products running low. A good place to start each morning.</p>,
    },
    {
      id: "orderboard",
      target: nav("orderboard"),
      placement: "right",
      title: "Packing and shipping",
      body: <p>Paid orders appear here. Move each one along: <strong>Start packing → Mark shipped → Mark delivered</strong>. The customer gets an email and WhatsApp when it ships and when it's delivered.</p>,
    },
    {
      id: "products",
      target: nav("products"),
      placement: "right",
      title: "Products",
      body: <p>Add products, update prices, descriptions and photos. Photos are stored safely online.</p>,
    },
    {
      id: "inventory",
      target: nav("inventory"),
      placement: "right",
      title: "Stock counts",
      body: <p>How many of each product are on the shelf. The shop and the website sell from the same shelf, so every sale (online or in the shop) takes stock off here automatically, and every change is recorded.</p>,
    },
    {
      id: "stockhistory",
      target: nav("stockhistory"),
      placement: "right",
      title: "Stock history",
      body: <p>Every stock movement with who made it and why. Record deliveries, customer returns and damaged or expired stock here too.</p>,
    },
    {
      id: "till",
      target: nav("till"),
      placement: "right",
      title: "The shop till",
      body: <p>Sell in the shop: scan or tap products, take cash, transfer or POS card, and print or WhatsApp a receipt. {owner ? "Only you can give discounts or void a sale." : "Your sales today are listed for cashing up."}</p>,
    },
    {
      id: "labels",
      target: nav("labels"),
      placement: "right",
      title: "Barcode labels",
      body: <p>Print price-and-barcode stickers on A4 sheets{owner ? ", or enter the barcode already printed on a product's packaging so it scans straight away" : ""}.</p>,
    },
    {
      id: "stocktake",
      target: nav("stocktake"),
      placement: "right",
      title: "Stock take",
      body: <p>Count the shelves by scanning each item with your phone. The shop can stay open while you count. {owner ? "You review what's missing or extra and approve it." : "The owner approves the result."}</p>,
    },
    {
      id: "suppliers",
      target: nav("suppliers"),
      placement: "right",
      title: "Suppliers, costs and profit",
      body: <p>Record deliveries with what you paid, see your margin on every product and what needs reordering, and your profit for any period. Only you can see this.</p>,
    },
    {
      id: "customers",
      target: nav("users"),
      placement: "right",
      title: "Customers, bookings and messages",
      body: <p>Look up a customer's orders and add private notes, keep the salon and bridal calendar, and answer messages from the contact form.</p>,
    },
    {
      id: "staff",
      target: nav("staff"),
      placement: "right",
      title: "Your team",
      body: <p>Add staff with their email: they get their own sign-in and only see what they need. Remove access any time; it ends immediately.</p>,
    },
    {
      id: "activity",
      target: nav("activity"),
      placement: "right",
      title: "Activity log",
      body: <p>Every change anyone makes in the portal (prices, stock, orders, refunds, staff), with who did it and when.</p>,
    },
    {
      id: "help",
      target: '[data-tour="admin-help"]',
      placement: "top",
      title: "Need this again?",
      body: <p>Replay this tour any time from here.</p>,
    },
    {
      id: "done",
      eyebrow: "Good to know",
      title: "You're ready",
      body: (
        <>
          <p>For security, sign-ins to this portal last 8 hours, with a code sent to your email each time.</p>
          {owner && <p>Every change (prices, stock, orders, refunds) is recorded with who made it and when.</p>}
        </>
      ),
      primary: "Start",
    },
  ];
};
