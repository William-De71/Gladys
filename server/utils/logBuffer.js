const MAX_LINES = 2000;

const lines = [];

// Regex matching all ANSI escape sequences (colors, bold, reset, etc.)
const ANSI_REGEX = /\x1B\[[0-9;]*[mGKHFABCDJsu]/g;

/**
 * @description Push a log line into the circular buffer.
 * @param {string} line - Log line to store.
 * @example
 * push('hello world');
 */
function push(line) {
  lines.push(line.replace(ANSI_REGEX, ''));
  if (lines.length > MAX_LINES) {
    lines.shift();
  }
}

/**
 * @description Return the last N lines from the in-memory log buffer.
 * @param {number} tail - Number of lines to return.
 * @returns {string[]} Array of log lines.
 * @example
 * const last100 = getLast(100);
 */
function getLast(tail) {
  return lines.slice(-tail);
}

/**
 * @description Build a patched write function that feeds the buffer before delegating to the original.
 * @param {Function} originalWrite - The original stream write function.
 * @returns {Function} Patched write function.
 * @example
 * process.stdout.write = intercept(process.stdout.write.bind(process.stdout));
 */
function intercept(originalWrite) {
  /**
   * @description Patched write that captures output into the log buffer.
   * @param {string|Buffer} chunk - Data to write.
   * @param {string} encoding - Encoding.
   * @param {Function} callback - Callback.
   * @returns {boolean} Result of original write.
   */
  return function write(chunk, encoding, callback) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    text
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .forEach(push);
    return originalWrite(chunk, encoding, callback);
  };
}

/**
 * @description Intercept process.stdout and process.stderr to feed the buffer.
 * Must be called once at process startup, before any logging occurs.
 * @example
 * install();
 */
function install() {
  process.stdout.write = intercept(process.stdout.write.bind(process.stdout));
  process.stderr.write = intercept(process.stderr.write.bind(process.stderr));
}

module.exports = { install, getLast };
