const { Op } = require('sequelize');
const db = require('../../models');
const logger = require('../../utils/logger');

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @description Purge old event logs (older than 30 days).
 * @returns {Promise<number>} The number of deleted entries.
 * @example
 * await eventLog.purge();
 */
async function purge() {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_IN_MS);
  logger.info(`EventLog: Purging event logs older than ${thirtyDaysAgo.toISOString()}`);
  const deleted = await db.EventLog.destroy({
    where: {
      created_at: {
        [Op.lt]: thirtyDaysAgo,
      },
    },
  });
  logger.info(`EventLog: Purged ${deleted} old event logs`);
  return deleted;
}

module.exports = {
  purge,
};
