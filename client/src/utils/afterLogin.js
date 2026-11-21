// Where customers land after signing in, and where the logo takes them.
//
// - Back to the page they were trying to reach (e.g. checkout), if any.
// - Otherwise admins go to the admin dashboard and customers to My Vanity.
// Only paths inside this site are followed, so a crafted ?from / state can't
// send someone to another website after they sign in.

export const VANITY_PATH = "/my-vanity";

const AUTH_PAGES = ["/login", "/register", "/verify-code"];

export function safeFrom(from) {
  if (typeof from !== "string") return null;
  if (!from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return null;
  const path = from.split(/[?#]/)[0];
  if (AUTH_PAGES.includes(path)) return null;
  return from;
}

export function afterLoginPath(user, from) {
  const back = safeFrom(from);
  if (back) return back;
  return user?.isAdmin ? "/admin" : VANITY_PATH;
}

// The logo: the admin dashboard for admins (the MD's portal), My Vanity for
// signed-in customers, the shop homepage otherwise.
export function homePath(user) {
  if (user?.isAdmin) return "/admin";
  return user ? VANITY_PATH : "/";
}

// The installed app (home-screen icon) opens on "/". For admins it should open
// their portal instead, once per session, so they can still visit the shop.
export function shouldOpenAdminOnLaunch({ user, pathname, standalone, alreadyOpened }) {
  return Boolean(user?.isAdmin && standalone && pathname === "/" && !alreadyOpened);
}
