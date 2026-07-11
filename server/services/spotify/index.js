const logger = require('../../utils/logger');
const SpotifyHandler = require('./lib');
const SpotifyController = require('./api/spotify.controller');
const { STATUS } = require('./lib/utils/spotify.constants');

module.exports = function SpotifyService(gladys, serviceId) {
  const spotifyHandler = new SpotifyHandler(gladys, serviceId);

  /**
   * @public
   * @description This function starts the Spotify service.
   * @example
   * gladys.services.spotify.start();
   */
  async function start() {
    logger.info('Starting Spotify service');
    await spotifyHandler.init();
  }

  /**
   * @public
   * @description This function stops the Spotify service.
   * @example
   * gladys.services.spotify.stop();
   */
  async function stop() {
    logger.info('Stopping Spotify service');
    spotifyHandler.stopPollPlaybackState();
  }

  /**
   * @public
   * @description Test if Spotify is used.
   * @returns {Promise<boolean>} Returns true if Spotify is connected.
   * @example
   * const used = await gladys.services.spotify.isUsed();
   */
  async function isUsed() {
    return spotifyHandler.status === STATUS.CONNECTED;
  }

  return Object.freeze({
    start,
    stop,
    isUsed,
    device: spotifyHandler,
    controllers: SpotifyController(spotifyHandler),
  });
};
