type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const MAX_STORED_LOGS = 200;
const logHistory: LogEntry[] = [];

export const logger = {
  log(level: LogLevel, context: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    };

    logHistory.unshift(entry);
    if (logHistory.length > MAX_STORED_LOGS) {
      logHistory.pop();
    }

    const prefix = `[DevForge:${context}]`;
    if (level === 'error') {
      console.error(prefix, message, data !== undefined ? data : '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data !== undefined ? data : '');
    } else if (level === 'info') {
      console.info(prefix, message, data !== undefined ? data : '');
    } else {
      console.debug(prefix, message, data !== undefined ? data : '');
    }
  },

  debug(context: string, message: string, data?: unknown) {
    this.log('debug', context, message, data);
  },

  info(context: string, message: string, data?: unknown) {
    this.log('info', context, message, data);
  },

  warn(context: string, message: string, data?: unknown) {
    this.log('warn', context, message, data);
  },

  error(context: string, message: string, data?: unknown) {
    this.log('error', context, message, data);
  },

  getHistory(): LogEntry[] {
    return [...logHistory];
  },

  clearHistory() {
    logHistory.length = 0;
  },
};
