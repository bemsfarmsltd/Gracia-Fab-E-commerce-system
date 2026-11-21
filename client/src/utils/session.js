// Reading the sign-in token's dates in the browser (no secrets involved: the
// payload of a JWT is plain base64). The server decides what's valid; this
// only lets the website tidy up expired sessions and renew in time.

const DAY_MS = 24 * 60 * 60 * 1000;
// Renew once the token is a day old, so each device asks at most daily.
export const RENEW_AFTER_MS = DAY_MS;

export function readToken(token) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const { iat, exp } = JSON.parse(json);
    return typeof exp === "number" ? { issuedAt: (iat || 0) * 1000, expiresAt: exp * 1000 } : null;
  } catch {
    return null;
  }
}

// Unreadable tokens count as expired: the session can't be trusted.
export function isExpired(token, now = Date.now()) {
  const t = readToken(token);
  return !t || t.expiresAt <= now;
}

export function needsRenewal(token, now = Date.now()) {
  const t = readToken(token);
  return Boolean(t && t.expiresAt > now && now - t.issuedAt >= RENEW_AFTER_MS);
}
