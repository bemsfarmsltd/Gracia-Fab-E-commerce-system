import jwt from "jsonwebtoken";

// How long a sign-in lasts without use. The website renews the token quietly
// (POST /api/auth/refresh) while someone keeps using it, so active customers
// stay signed in; a lost phone's session dies after a week of no use.
export const SESSION_DAYS = 7;

// Admin sign-ins end 8 hours after the person signed in, however active they
// are: renewing never extends them (the original sign-in time travels in the
// token as `at`). adminMiddleware enforces it on every admin request too.
export const ADMIN_SESSION_HOURS = 8;
export const ADMIN_SESSION_SECONDS = ADMIN_SESSION_HOURS * 60 * 60;

const nowSeconds = () => Math.floor(Date.now() / 1000);

// generateToken(user._id, { isAdmin, authTime })
//   isAdmin: anyone using the admin portal (owner or staff) gets the 8-hour sign-in.
//   authTime: when the person actually signed in (seconds). Pass it when
//   renewing; leave it out at sign-in.
const generateToken = (id, { isAdmin = false, authTime } = {}) => {
  const at = authTime ?? nowSeconds();
  const expiresIn = isAdmin
    ? Math.max(1, at + ADMIN_SESSION_SECONDS - nowSeconds())
    : `${SESSION_DAYS}d`;
  return jwt.sign({ id, at }, process.env.JWT_SECRET, { expiresIn });
};

export default generateToken;
