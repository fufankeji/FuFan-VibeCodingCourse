const LEVEL_COLORS: Record<string, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

function log(level: string, msg: string, data?: unknown) {
  const color = LEVEL_COLORS[level] || "";
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `${color}[${ts}] ${level.toUpperCase().padEnd(5)}${RESET}`;
  if (data !== undefined) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};
