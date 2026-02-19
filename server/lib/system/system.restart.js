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
  // exit(1): Docker/systemd restarts on non-zero exit.
  // In dev, nodemon with exitcrash:true would loop on other crashes,
  // so we rely on the user restarting manually or use a process manager.
  process.exit(1);
}

module.exports = {
  restart,
};
