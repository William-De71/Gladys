const logger = require('../../../utils/logger');
const { FREEBOX_APPTOKEN_KEY } = require('./utils/constants');

/**
 * @description Disconnect service.
 * @example
 * disconnect();
 */
function disconnect() {
  logger.debug(`Disconnecting from Freebox...`);
  this.gladys.variable.destroy(FREEBOX_APPTOKEN_KEY, this.serviceId);

}

module.exports = {
  disconnect,
};
