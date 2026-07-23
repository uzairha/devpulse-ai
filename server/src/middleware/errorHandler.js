import logger from '../lib/logger.js';

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode === 500) {
    logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  }

  res.status(statusCode).json({
    error: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
};

export default errorHandler;
