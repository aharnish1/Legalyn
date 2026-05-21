const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'INFO';

function log(level, ...args) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    if (level === 'ERROR') {
      console.error(prefix, ...args);
    } else if (level === 'WARN') {
      console.warn(prefix, ...args);
    } else {
      console.log(prefix, ...args);
    }
  }
}

const logger = {
  debug: (...args) => log('DEBUG', ...args),
  info: (...args) => log('INFO', ...args),
  warn: (...args) => log('WARN', ...args),
  error: (...args) => log('ERROR', ...args)
};

module.exports = logger;
