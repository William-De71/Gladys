const logger = require('../../../utils/logger');
const { EVENTS, MUSIC_PLAYBACK_STATE, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');
const {
  API,
  PLAYBACK_STATE_POLLING_FREQUENCY_IN_MS,
  REFRESH_AFTER_COMMAND_DELAY_IN_MS,
  VOLUME_COMMAND_GRACE_PERIOD_IN_MS,
} = require('./utils/spotify.constants');

/**
 * @description Emit a new state for a Spotify device feature, only if it exists in Gladys.
 * @param {object} self - The Spotify handler.
 * @param {string} deviceFeatureExternalId - The feature external id.
 * @param {number} state - The new state.
 * @example
 * emitStateIfExists(this, 'spotify:xxx:playback-state', 1);
 */
function emitStateIfExists(self, deviceFeatureExternalId, state) {
  const feature = self.gladys.stateManager.get('deviceFeatureByExternalId', deviceFeatureExternalId);
  if (feature && feature.last_value !== state) {
    self.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: deviceFeatureExternalId,
      state,
    });
  }
}

/**
 * @description Build the current playback summary from the Spotify API response.
 * @param {object} data - Spotify GET /me/player response.
 * @returns {object|null} Playback summary, or null when nothing is playing.
 * @example
 * buildCurrentPlayback(data);
 */
function buildCurrentPlayback(data) {
  if (!data || !data.device) {
    return null;
  }
  const item = data.item || {};
  const album = item.album || {};
  const images = album.images || [];
  // Spotify returns images sorted from largest to smallest, the medium one (300px) fits the box
  const artwork = images.length > 1 ? images[1] : images[0];
  return {
    isPlaying: data.is_playing === true,
    trackName: item.name || null,
    artists: (item.artists || []).map((artist) => artist.name).join(', ') || null,
    albumName: album.name || null,
    artworkUrl: artwork ? artwork.url : null,
    deviceId: data.device.id,
    deviceName: data.device.name,
    volumePercent: data.device.volume_percent,
    progressMs: data.progress_ms || 0,
    durationMs: item.duration_ms || 0,
  };
}

/**
 * @description Get the current Spotify playback state and update the Gladys devices.
 * @returns {Promise<object|null>} Resolves with the current playback summary.
 * @example
 * await spotify.refreshPlaybackState();
 */
async function refreshPlaybackState() {
  try {
    const data = await this.callApi('GET', API.PLAYER);
    const activeDeviceId = data && data.device ? data.device.id : null;
    if (this.lastActiveDeviceId && this.lastActiveDeviceId !== activeDeviceId) {
      emitStateIfExists(this, `spotify:${this.lastActiveDeviceId}:playback-state`, MUSIC_PLAYBACK_STATE.PAUSED);
    }
    if (activeDeviceId) {
      const playbackState = data.is_playing ? MUSIC_PLAYBACK_STATE.PLAYING : MUSIC_PLAYBACK_STATE.PAUSED;
      emitStateIfExists(this, `spotify:${activeDeviceId}:playback-state`, playbackState);
      // Right after a volume command, the API still reports the old volume: don't
      // send it back to Gladys or the volume slider jumps back to the previous value
      const volumeJustSet = Date.now() - this.lastVolumeCommandAt < VOLUME_COMMAND_GRACE_PERIOD_IN_MS;
      if (!volumeJustSet && data.device.volume_percent !== null && data.device.volume_percent !== undefined) {
        emitStateIfExists(this, `spotify:${activeDeviceId}:volume`, data.device.volume_percent);
      }
    }
    this.lastActiveDeviceId = activeDeviceId;
    this.currentPlayback = buildCurrentPlayback(data);
    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.PLAYBACK,
      payload: this.currentPlayback,
    });
  } catch (e) {
    logger.debug('Spotify: unable to refresh playback state: ', e);
  }
  return this.currentPlayback;
}

/**
 * @description Refresh the playback state shortly after a command, so the dashboard
 * reflects the change quickly (the Spotify API needs a moment to report the new state).
 * @example
 * spotify.refreshPlaybackStateSoon();
 */
function refreshPlaybackStateSoon() {
  clearTimeout(this.refreshPlaybackStateTimeout);
  this.refreshPlaybackStateTimeout = setTimeout(() => {
    this.refreshPlaybackState();
  }, REFRESH_AFTER_COMMAND_DELAY_IN_MS);
}

/**
 * @description Start polling the Spotify playback state.
 * @example
 * spotify.pollPlaybackState();
 */
function pollPlaybackState() {
  this.stopPollPlaybackState();
  this.pollPlaybackStateInterval = setInterval(
    this.refreshPlaybackState.bind(this),
    PLAYBACK_STATE_POLLING_FREQUENCY_IN_MS,
  );
  this.refreshPlaybackState();
}

/**
 * @description Stop polling the Spotify playback state.
 * @example
 * spotify.stopPollPlaybackState();
 */
function stopPollPlaybackState() {
  if (this.pollPlaybackStateInterval) {
    clearInterval(this.pollPlaybackStateInterval);
    this.pollPlaybackStateInterval = undefined;
  }
  clearTimeout(this.refreshPlaybackStateTimeout);
  this.refreshPlaybackStateTimeout = undefined;
}

module.exports = {
  refreshPlaybackState,
  refreshPlaybackStateSoon,
  pollPlaybackState,
  stopPollPlaybackState,
};
