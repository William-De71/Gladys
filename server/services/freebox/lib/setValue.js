const logger = require('../../../utils/logger');
const { BadParameters } = require('../../../utils/coreErrors');
const { writeValues } = require('./device/deviceMapping');
const { COVER_STATE } = require('../../../utils/constants');

/**
 * @description Send the new device value over device protocol.
 * @param {object} device - Updated Gladys device.
 * @param {object} deviceFeature - Updated Gladys device feature.
 * @param {string|number} value - The new device feature value.
 * @example
 * setValue(device, deviceFeature, 0);
 */
async function setValue(device, deviceFeature, value) {

  // Ensure Freebox has been discovered (baseAPIURL is set)
  if (!this.baseAPIURL) {
    await this.discoverFreebox();
  }

  // Token is null, we need to get a session token to login
  if (this.sessionToken === null) {
    this.sessionToken = await this.getSessionToken();
  }

  const externalId = deviceFeature.external_id;
  const [prefix, nodeId, endpointId] = deviceFeature.external_id.split(':');

  if (prefix !== 'freebox') {
    throw new BadParameters(`Freebox device external_id is invalid: "${externalId}" should starts with "freebox:"`);
  }
  if (!nodeId || nodeId.length === 0) {
    throw new BadParameters(`Freebox device external_id is invalid: "${externalId}" have no network indicator`);
  }

  const transformedValue = writeValues[deviceFeature.category][deviceFeature.type](value);

  let endpointIdtoDevice;
  let valuetoDevice;
  
  switch (device.model) {
    case 'alarm_control':
      endpointIdtoDevice = endpointId;
      valuetoDevice = null;
      break;
    case 'store': 
      if (endpointId === '1') {
        valuetoDevice = null;
        if (transformedValue === COVER_STATE.CLOSE) {
          endpointIdtoDevice = 2;
        }
        if (transformedValue === COVER_STATE.OPEN) {
          endpointIdtoDevice = 0;
        }
        if (transformedValue === COVER_STATE.STOP) {
          endpointIdtoDevice = endpointId;
        }
      }
      break;
    case 'store_slider':

      endpointIdtoDevice = endpointId;
      valuetoDevice = transformedValue;

      if (endpointId === '1') {
        if (transformedValue === COVER_STATE.CLOSE) {
          endpointIdtoDevice = 3;
          valuetoDevice = 100;
        }
        if (transformedValue === COVER_STATE.OPEN) {
          endpointIdtoDevice = 3;
          valuetoDevice = 0;
        }
        if (transformedValue === COVER_STATE.STOP) {
          endpointIdtoDevice = endpointId;
          valuetoDevice = null;
        }
      }
      break;
    default:
      endpointIdtoDevice = endpointId;
      valuetoDevice = transformedValue;
  }
  
  logger.debug(`Change value for devices ${nodeId}/${endpointIdtoDevice} to value ${valuetoDevice}...`);

  try {
    await this.request({
      method: 'PUT',
      baseURL: this.baseAPIURL,
      headers: {'X-Fbx-App-Auth': this.sessionToken},
      url: `/home/endpoints/${nodeId}/${endpointIdtoDevice}`,
      data: JSON.stringify({
        value: valuetoDevice,
      }),
    });
  } catch (error) {

    if (!error.response) {
      throw error;
    }

    const {status, data} = error.response;
    const { error_code: errorCode } = data;
    const isTokenExpired =
      status === 403 &&
      errorCode === 'auth_required';

    if (!isTokenExpired) {
      throw error;
    }

    // Token has expired, we need to login and retry
    this.sessionToken = await this.getSessionToken();
    await this.request({
      method: 'PUT',
      baseURL: this.baseAPIURL,
      headers: {'X-Fbx-App-Auth': this.sessionToken},
      url: `/home/endpoints/${nodeId}/${endpointIdtoDevice}`,
      data: JSON.stringify({
        value: valuetoDevice,
      }),
    });
  }
  
}

module.exports = {
  setValue,
};
