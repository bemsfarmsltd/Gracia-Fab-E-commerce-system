import logger from "../utils/logger.js";
import { GENERIC_SERVER_ERROR } from "../utils/httpErrors.js";
import { captureError } from "../utils/monitoring.js";

// Catches every error passed to next() or thrown in a route.
const errorHandler = (err, req, res, next) => {
  // The full error goes to the server log.
  logger.error({ err, method: req.method, path: req.path }, "Request error");

  const statusCode = err.status || err.statusCode || 500;
  if (statusCode >= 500) captureError(err, { path: req.route?.path || req.path, method: req.method });
  const isProduction = process.env.NODE_ENV === "production";

  // 4xx messages are deliberate ("Route not found", bad JSON, ...). 5xx
  // messages can leak internals (database errors, SDK responses), so in
  // production the customer only gets a generic message.
  const message =
    statusCode >= 500 && isProduction
      ? GENERIC_SERVER_ERROR
      : err.message || GENERIC_SERVER_ERROR;

  res.status(statusCode).json({
    success: false,
    message,
    // Only show detailed errors in development, not in production
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      path: req.path,
    }),
  });
};

// This catches requests to routes that don't exist
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export { errorHandler, notFound };
