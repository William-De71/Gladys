const logger = require('../../../utils/logger');
const { NotFoundError } = require('../../../utils/coreErrors');
const { WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');

/**
 * @description Discover Freebox on local network and get the api version.
 * @returns {Promise} Return discovered Freebox.
 * @example
 * connect(configuration);
 */
async function discoverFreebox() {

  let discoveryResponse;
  try {
    discoveryResponse = await this.discovery();

    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.DISCOVER,
    });
    
    const {
      box_model_name: boxModelName, 
      api_base_url: apiBaseUrl,
      https_port: httpsPort, 
      device_name: deviceName, 
      box_model : boxModel,
      api_domain: apiDomain, 
      uid, 
      api_version: apiVersion
    } = discoveryResponse.data;
    
    const [ apiVersionMajor,  ] = apiVersion.split('.');
    
    logger.debug(`Success to discover your Freebox on the local network at "${this.baseURL}")`);

    this.baseAPIURL = `${this.baseURL}${apiBaseUrl}v${apiVersionMajor}`;
    logger.debug(` "${this.baseAPIURL}")`);

    return {
      boxModelName,
      apiBaseUrl,
      httpsPort,
      deviceName,
      boxModel,
      apiDomain,
      uid,
      apiVersionMajor
    };

  } catch (e) {
    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR,
    });
    logger.error(`You are probably not connected to your Freebox network (check "${this.baseURL}")`);
    logger.debug(e);

    throw new NotFoundError(`Freebox not found`);
    
  }

};

module.exports = {
    discoverFreebox,
};