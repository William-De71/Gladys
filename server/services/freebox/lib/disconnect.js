const logger = require('../../../utils/logger');
const { FREEBOX_APPTOKEN_KEY } = require('./utils/constants');

/**
 * @description Disconnect service.
 * @example
 * disconnect();
 */
async function disconnect() {
  logger.debug(`Disconnecting from Freebox...`);
  await this.gladys.variable.destroy(FREEBOX_APPTOKEN_KEY, this.serviceId);
  this.sessionToken = null;
}

module.exports = {
  disconnect,
};
