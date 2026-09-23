// Wraps an async controller so any thrown error / rejected promise
// is passed to next(err) automatically -> lands in errorMiddleware.js
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
