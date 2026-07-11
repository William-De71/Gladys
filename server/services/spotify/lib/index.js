const { init } = require('./spotify.init');
const { connect } = require('./spotify.connect');
const { retrieveTokens } = require('./spotify.retrieveTokens');
const { refreshingTokens } = require('./spotify.refreshingTokens');
const { getAccessToken } = require('./spotify.getAccessToken');
const { setTokens } = require('./spotify.setTokens');
const { disconnect } = require('./spotify.disconnect');
const { getConfiguration } = require('./spotify.getConfiguration');
const { saveConfiguration } = require('./spotify.saveConfiguration');
const { getStatus } = require('./spotify.getStatus');
const { saveStatus } = require('./spotify.saveStatus');
const { callApi } = require('./spotify.callApi');
const { discoverDevices } = require('./spotify.discoverDevices');
const { setValue } = require('./spotify.setValue');
const {
  refreshPlaybackState,
  refreshPlaybackStateSoon,
  pollPlaybackState,
  stopPollPlaybackState,
} = require('./spotify.pollPlaybackState');

const { STATUS } = require('./utils/spotify.constants');

const SpotifyHandler = function SpotifyHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
  this.configuration = {
    clientId: null,
    clientSecret: null,
  };
  this.configured = false;
  this.connected = false;
  this.status = STATUS.NOT_INITIALIZED;
  this.accessToken = null;
  this.refreshToken = null;
  this.tokenExpiresAt = 0;
  this.stateGetAccessToken = null;
  this.codeVerifier = null;
  this.pollPlaybackStateInterval = undefined;
  this.refreshPlaybackStateTimeout = undefined;
  this.lastActiveDeviceId = null;
  this.lastVolumeCommandAt = 0;
  /** @type {object|null} */
  this.currentPlayback = null;
  /** @type {any[]} */
  this.discoveredDevices = [];
};

SpotifyHandler.prototype.init = init;
SpotifyHandler.prototype.connect = connect;
SpotifyHandler.prototype.retrieveTokens = retrieveTokens;
SpotifyHandler.prototype.refreshingTokens = refreshingTokens;
SpotifyHandler.prototype.getAccessToken = getAccessToken;
SpotifyHandler.prototype.setTokens = setTokens;
SpotifyHandler.prototype.disconnect = disconnect;
SpotifyHandler.prototype.getConfiguration = getConfiguration;
SpotifyHandler.prototype.saveConfiguration = saveConfiguration;
SpotifyHandler.prototype.getStatus = getStatus;
SpotifyHandler.prototype.saveStatus = saveStatus;
SpotifyHandler.prototype.callApi = callApi;
SpotifyHandler.prototype.discoverDevices = discoverDevices;
SpotifyHandler.prototype.setValue = setValue;
SpotifyHandler.prototype.refreshPlaybackState = refreshPlaybackState;
SpotifyHandler.prototype.refreshPlaybackStateSoon = refreshPlaybackStateSoon;
SpotifyHandler.prototype.pollPlaybackState = pollPlaybackState;
SpotifyHandler.prototype.stopPollPlaybackState = stopPollPlaybackState;

module.exports = SpotifyHandler;
