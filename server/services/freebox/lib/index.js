const { init } = require('./init');
const { request } = require('./commands/request');
const { discovery } = require('./commands/discovery');
const { requestAuthorization } = require('./commands/requestAuthorization');
const { trackAuthorizationProgress } = require('./commands/trackAuthorizationProgress');
const { getAuthorizationStatus } = require('./commands/getAuthorizationStatus');
const { getChallenge } = require('./commands/getChallenge');
const { openSession } = require('./commands/openSession');
const { getSessionToken } = require('./getSessionToken');
const { closeSession } = require('./commands/closeSession');
const { restartFreebox } = require('./commands/restartFreebox');
const { convertDevice } = require('./device/convertDevice');
const { convertFeature } = require('./device/convertFeature');
const { discoverFreebox } = require('./discoverFreebox');
const { connectFreebox} = require('./connectFreebox');
const { discoverDevices } = require('./discoverDevices');
const { loadDevices } = require('./loadDevices');
const { loadDeviceDetails } = require('./loadDeviceDetails');
const { disconnect } = require('./disconnect');
const { setValue } = require('./setValue');
const { poll } = require('./poll');

const { CONFIGURATION } = require('./utils/constants');

/**
 * @description Add ability to connect to a FREEBOX.
 * @param {object} gladys - Gladys instance.
 * @param {string} serviceId - UUID of the service in DB.
 * @example
 * const freeboxHandler = new FreeboxHandler(gladys, serviceId);
 */
const FreeboxHandler = function FreeboxHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;

  this.axiosInstance = null;

  this.baseURL = CONFIGURATION.FREEBOX_LOCAL_URL;
  this.baseAPIURL = null;

  this.app_token = null;
  this.sessionToken = null;

};

FreeboxHandler.prototype.init = init;
FreeboxHandler.prototype.request = request;
FreeboxHandler.prototype.discovery = discovery;
FreeboxHandler.prototype.requestAuthorization = requestAuthorization;
FreeboxHandler.prototype.trackAuthorizationProgress = trackAuthorizationProgress;
FreeboxHandler.prototype.getAuthorizationStatus = getAuthorizationStatus;
FreeboxHandler.prototype.getChallenge = getChallenge;
FreeboxHandler.prototype.openSession = openSession;
FreeboxHandler.prototype.getSessionToken = getSessionToken;
FreeboxHandler.prototype.closeSession = closeSession;
FreeboxHandler.prototype.restartFreebox = restartFreebox;
FreeboxHandler.prototype.convertDevice = convertDevice;
FreeboxHandler.prototype.convertFeature = convertFeature;
FreeboxHandler.prototype.discoverFreebox = discoverFreebox;
FreeboxHandler.prototype.connectFreebox = connectFreebox;
FreeboxHandler.prototype.discoverDevices = discoverDevices;
FreeboxHandler.prototype.loadDevices = loadDevices;
FreeboxHandler.prototype.loadDeviceDetails = loadDeviceDetails;
FreeboxHandler.prototype.disconnect = disconnect;
FreeboxHandler.prototype.setValue = setValue;
FreeboxHandler.prototype.poll = poll;

module.exports = FreeboxHandler;
