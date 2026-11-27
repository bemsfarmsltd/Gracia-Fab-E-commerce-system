import { ALL_PERMISSIONS, STAFF_PERMISSIONS } from "../config/permissions.js";

// "owner" (isAdmin: the MD), "staff" (role: "staff"), or "customer".
// The owner flag stays isAdmin so every existing admin is an owner with no
// data change.
export const roleOf = (user) => {
  if (!user) return "customer";
  if (user.isAdmin) return "owner";
  return user.role === "staff" ? "staff" : "customer";
};

export const permissionsOf = (user) => {
  const role = roleOf(user);
  if (role === "owner") return [...ALL_PERMISSIONS];
  if (role === "staff") return [...STAFF_PERMISSIONS];
  return [];
};

export const canUsePortal = (user) => roleOf(user) !== "customer";

export const hasPermission = (user, permission) => permissionsOf(user).includes(permission);

// The account fields every sign-in response carries, so the website knows
// what to show. The server checks permissions again on every request.
export const accountFields = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: Boolean(user.isAdmin),
  role: roleOf(user),
  permissions: permissionsOf(user),
});
