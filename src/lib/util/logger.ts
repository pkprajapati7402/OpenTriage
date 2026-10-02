export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    console.log(`[OpenTriage INFO] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`[OpenTriage WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[OpenTriage ERROR] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.log(`[OpenTriage DEBUG] ${msg}`, ...args);
    }
  },
};
