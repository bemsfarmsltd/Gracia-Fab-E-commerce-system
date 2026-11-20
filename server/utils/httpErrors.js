import logger from "./logger.js";
import { captureError } from "./monitoring.js";

const GENERIC = "Something went wrong on our side. Please try again.";

// Sends a 500 without leaking internals. Error text from Mongoose, MongoDB,
// third-party SDKs etc. can expose field names, queries or infrastructure,
// so in production customers get a generic message and the real error goes
// to the server log. In development and tests the real message is returned
// to keep debugging easy.
//
// Deliberate, customer-facing messages belong in 4xx responses, not here.
export function sendServerError(res, error, context = "Server error", publicMessage = GENERIC) {
  logger.error({ err: error, path: res.req?.originalUrl, method: res.req?.method }, context);
  captureError(error, { context, path: res.req?.route?.path || res.req?.path, method: res.req?.method });
  const message =
    process.env.NODE_ENV === "production" ? publicMessage : error?.message || publicMessage;
  return res.status(500).json({ message });
}

export const GENERIC_SERVER_ERROR = GENERIC;
