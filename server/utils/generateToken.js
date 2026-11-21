import jwt from "jsonwebtoken";

// How long a sign-in lasts without use. The website renews the token quietly
// (POST /api/auth/refresh) while someone keeps using it, so active customers
// stay signed in; a lost phone's session dies after a week of no use.
export const SESSION_DAYS = 7;

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });

export default generateToken;
