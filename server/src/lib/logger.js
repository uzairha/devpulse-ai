import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format:
    process.env.NODE_ENV === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

export default logger;
