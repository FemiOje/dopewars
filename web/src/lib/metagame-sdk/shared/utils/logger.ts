export type LogLevel = "debug" | "info" | "warn" | "error" | "none";

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

class Logger {
  private config: LoggerConfig = {
    enabled: false,
    level: "error",
  };

  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  debug(...args: any[]) {
    if (this.shouldLog("debug")) {
      console.log("[Metagame SDK]", ...args);
    }
  }

  info(...args: any[]) {
    if (this.shouldLog("info")) {
      console.info("[Metagame SDK]", ...args);
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn("[Metagame SDK]", ...args);
    }
  }

  error(...args: any[]) {
    if (this.shouldLog("error")) {
      console.error("[Metagame SDK]", ...args);
    }
  }
}

export const logger = new Logger();
