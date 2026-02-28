const logger = require('../../utils/logger');
const ThermostatHandler = require('./lib');
const ThermostatController = require('./api/thermostat.controller');

module.exports = function ThermostatService(gladys, serviceId) {
  const thermostatHandler = new ThermostatHandler(gladys, serviceId);
  let scheduleInterval = null;

  /**
   * @public
   * @description This function starts the Thermostat service.
   * @example
   * gladys.services.thermostat.start();
   */
  async function start() {
    logger.info('Starting thermostat service');
    // Apply schedules every minute
    scheduleInterval = setInterval(async () => {
      await thermostatHandler.applySchedules();
    }, 60 * 1000);
    // Run once immediately on start
    await thermostatHandler.applySchedules();
  }

  /**
   * @public
   * @description This function stops the Thermostat service.
   * @example
   * gladys.services.thermostat.stop();
   */
  async function stop() {
    logger.info('Stopping thermostat service');
    if (scheduleInterval) {
      clearInterval(scheduleInterval);
      scheduleInterval = null;
    }
  }

  return Object.freeze({
    start,
    stop,
    device: thermostatHandler,
    controllers: ThermostatController(thermostatHandler),
  });
};
