const path = require('path');
const { spawn } = require('child_process');

const logger = require('../../utils/logger');
const { JOB_TYPES, JOB_STATUS } = require('../../utils/constants');

/**
 * @description Restart Gladys instance.
 * @example
 * restart();
 */
async function restart() {
  let job;
  try {
    job = await this.job.start(JOB_TYPES.GLADYS_RESTART);
    await this.job.finish(job.id, JOB_STATUS.SUCCESS);
  } catch (e) {
    logger.warn(e);
  }
  // Wait 1s to ensure DB writes are flushed before closing
  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
  try {
    await this.sequelize.close();
  } catch (e) {
    logger.info('Database is probably already closed');
    logger.warn(e);
  }
  // Touch index.js to trigger nodemon file-watcher restart (dev without Docker).
  // In production, Docker restart:always handles the clean exit.
  const indexPath = path.join(__dirname, '../../index.js');
  const script = `var t=new Date();require('fs').utimesSync(${JSON.stringify(indexPath)},t,t)`;
  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  process.exit(0);
}

module.exports = {
  restart,
};
