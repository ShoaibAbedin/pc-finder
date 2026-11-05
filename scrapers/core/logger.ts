export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  child(prefix: string): Logger;
}

export function createLogger(prefix = ""): Logger {
  const fmt = (level: string, msg: string) =>
    `${new Date().toISOString()} ${level}${prefix ? ` [${prefix}]` : ""} ${msg}`;
  return {
    info: (m) => console.log(fmt("INFO ", m)),
    warn: (m) => console.warn(fmt("WARN ", m)),
    error: (m) => console.error(fmt("ERROR", m)),
    child: (p) => createLogger(prefix ? `${prefix}:${p}` : p),
  };
}

export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};
