/**
 * Lightweight logger with level control.
 * In production, only WARN and ERROR are shown.
 * Set localStorage 'debug_level' to 'debug' for verbose output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('debug_level');
    if (stored && stored in LEVEL_PRIORITY) return stored as LogLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

export const logger = {
  debug: (...args: unknown[]) => { if (shouldLog('debug')) console.debug('[DBG]', ...args); },
  info: (...args: unknown[]) => { if (shouldLog('info')) console.log('[INF]', ...args); },
  warn: (...args: unknown[]) => { if (shouldLog('warn')) console.warn('[WRN]', ...args); },
  error: (...args: unknown[]) => { if (shouldLog('error')) console.error('[ERR]', ...args); },
};

export default logger;
