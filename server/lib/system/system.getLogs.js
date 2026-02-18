const logBuffer = require('../../utils/logBuffer');

const DEFAULT_TAIL = 200;
const MAX_TAIL = 2000;

const ANSI_REGEX = /\x1B\[[0-9;]*[mGKHFABCDJsu]/g;

/**
 * @description Parse a Docker multiplexed log buffer into an array of strings.
 * @param {Buffer} buf - Raw buffer returned by dockerode container.logs().
 * @returns {string[]} Array of log lines.
 * @example
 * const lines = parseDockerBuffer(buf);
 */
function parseDockerBuffer(buf) {
  const lines = [];
  let offset = 0;

  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (offset + 8 + size > buf.length) {
      break;
    }
    const line = buf.slice(offset + 8, offset + 8 + size).toString('utf8');
    line
      .split('\n')
      .map((l) => l.trimEnd().replace(ANSI_REGEX, ''))
      .filter((l) => l.length > 0)
      .forEach((l) => lines.push(l));
    offset += 8 + size;
  }

  // Fallback for TTY-mode containers (no multiplexed header)
  if (lines.length === 0 && buf.length > 0) {
    buf
      .toString('utf8')
      .split('\n')
      .map((l) => l.trimEnd().replace(ANSI_REGEX, ''))
      .filter((l) => l.length > 0)
      .forEach((l) => lines.push(l));
  }

  return lines;
}

/**
 * @description Return the last lines of logs from the Gladys Docker container,
 * or from the in-memory log buffer when not running inside Docker.
 * @param {object} [options] - Options.
 * @param {number} [options.tail] - Number of lines to return (default 200, max 2000).
 * @returns {Promise<object>} Resolve with { logs: string[], source: 'docker'|'buffer' }.
 * @example
 * const { logs } = await getLogs({ tail: 100 });
 */
async function getLogs(options = {}) {
  const tail = Math.min(parseInt(options.tail, 10) || DEFAULT_TAIL, MAX_TAIL);

  // Try Docker first
  if (this.dockerode) {
    try {
      const containerId = await this.getGladysContainerId();
      const container = this.dockerode.getContainer(containerId);
      const logsBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      const buf = Buffer.isBuffer(logsBuffer) ? logsBuffer : Buffer.from(logsBuffer);
      return { logs: parseDockerBuffer(buf), source: 'docker' };
    } catch (e) {
      // Docker available but container ID not found (e.g. dev with docker.sock mounted)
      // Fall through to in-memory buffer
    }
  }

  // Fallback: in-memory buffer captured from process.stdout/stderr
  return { logs: logBuffer.getLast(tail), source: 'buffer' };
}

module.exports = {
  getLogs,
};
