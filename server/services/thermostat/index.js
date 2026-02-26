const logger = require('../../utils/logger');
const ThermostatHandler = require('./lib');
const ThermostatController = require('./api/thermostat.controller');

module.exports = function ThermostatService(gladys, serviceId) {
  const thermostatHandler = new ThermostatHandler(gladys, serviceId);

  /**
   * @public
   * @description This function starts the Thermostat service.
   * @example
   * gladys.services.thermostat.start();
   */
  async function start() {
    logger.info('Starting thermostat service');
  }

  /**
   * @public
   * @description This function stops the Thermostat service.
   * @example
   * gladys.services.thermostat.stop();
   */
  async function stop() {
    logger.info('Stopping thermostat service');
  }

  return Object.freeze({
    start,
    stop,
    device: thermostatHandler,
    controllers: ThermostatController(thermostatHandler),
  });
};
