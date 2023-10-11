const { BadParameters } = require('../../../utils/coreErrors');
const { readValues } = require('./device/deviceMapping');
const { EVENTS } = require('../../../utils/constants');

/**
 *
 * @description Poll values of an Tuya device.
 * @param {object} device - The device to poll.
 * @returns {Promise} Promise of nothing.
 * @example
 * poll(device);
 */
async function poll(device) {

  // Token has null, we need to get a session token to login
  if (this.sessionToken === null) {
    this.sessionToken = await this.getSessionToken();
  }

  const externalId = device.external_id;
  const [prefix, nodeId] = device.external_id.split(':');

  if (prefix !== 'freebox') {
    throw new BadParameters(`Freebox device external_id is invalid: "${externalId}" should starts with "freebox:"`);
  }
  if (!nodeId || nodeId.length === 0) {
    throw new BadParameters(`Freebox device external_id is invalid: "${externalId}" have no network indicator`);
  }
  
  let response = null;
  let isTokenExpired = false;

  try{
    response = await this.request({
      method: 'GET',
      baseURL: this.baseAPIURL,
      headers: {'X-Fbx-App-Auth': this.sessionToken},
      url: `/home/tileset/${nodeId}`,
    });
  } catch(error) {

    if (!error.response) {
      throw error;
    }

    const {status, data} = error.response;
    const { error_code: errorCode } = data;
    isTokenExpired =
      status === 403 &&
      errorCode === 'auth_required';

    if (!isTokenExpired) {
      throw error;
    }

    // Token has expired, we need to login
    this.sessionToken = await this.getSessionToken();
  }

  if (!isTokenExpired) {
    const { data } = response.data.result[0];
    
    const values = {};
    data.forEach((feature) => {
      values[feature.ep_id] = feature.value;
    });

    device.features.forEach((deviceFeature) => {
      const [, , epId] = deviceFeature.external_id.split(':');

      const value = values[epId];
      const transformedValue = readValues[deviceFeature.category][deviceFeature.type](value);

      if (transformedValue !== null && transformedValue !== undefined) {
        // if is a text
        if (deviceFeature.category === 'text') {
          const event = {
            device_feature_external_id: deviceFeature.external_id,
            text: transformedValue,
          };
          if (deviceFeature.last_value_string !== event.text) {
            this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, event);
          }
        } else {
          const event = {
            device_feature_external_id: deviceFeature.external_id,
            state: transformedValue,
          };
          if (deviceFeature.last_value !== event.state) {
            this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, event);
          }
        }
      }
      
    });
  }

}

module.exports = {
  poll,
};
