const logger = require('../../utils/logger');
const FreeboxController = require('./api/freebox.controller');
const FreeboxHandler = require('./lib');

module.exports = function FreeboxService(gladys, serviceId) {
    const freeboxHandler = new FreeboxHandler(gladys, serviceId);
  
    /**
     * @public
     * @description This function starts service.
     * @example
     * gladys.services.freebox.start();
     */
    async function start() {
      logger.info('Starting Freebox service');
      await freeboxHandler.init();
    }
  
    /**
     * @public
     * @description This function stops the service.
     * @example
     *  gladys.services.freebox.stop();
     */
    async function stop() {
      logger.info('Stopping Freebox service');
      await freeboxHandler.disconnect();
    }
  
    return Object.freeze({
      start,
      stop,
      device: freeboxHandler,
      controllers: FreeboxController(freeboxHandler),
    });
  };
  