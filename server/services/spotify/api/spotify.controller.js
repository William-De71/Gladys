const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');

module.exports = function SpotifyController(spotifyHandler) {
  /**
   * @api {get} /api/v1/service/spotify/configuration Get Spotify configuration.
   * @apiName getConfiguration
   * @apiGroup Spotify
   */
  async function getConfiguration(req, res) {
    const configuration = await spotifyHandler.getConfiguration();
    res.json(configuration);
  }

  /**
   * @api {post} /api/v1/service/spotify/configuration Save Spotify configuration.
   * @apiName saveConfiguration
   * @apiGroup Spotify
   */
  async function saveConfiguration(req, res) {
    const result = await spotifyHandler.saveConfiguration(req.body);
    res.json({
      success: result,
    });
  }

  /**
   * @api {get} /api/v1/service/spotify/status Get Spotify connection status.
   * @apiName getStatus
   * @apiGroup Spotify
   */
  async function getStatus(req, res) {
    const result = await spotifyHandler.getStatus();
    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/spotify/connect Get the Spotify authorization URL.
   * @apiName connect
   * @apiGroup Spotify
   */
  async function connect(req, res) {
    await spotifyHandler.getConfiguration();
    const result = await spotifyHandler.connect();
    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/spotify/token Exchange the OAuth code against access tokens.
   * @apiName retrieveTokens
   * @apiGroup Spotify
   */
  async function retrieveTokens(req, res) {
    await spotifyHandler.getConfiguration();
    const result = await spotifyHandler.retrieveTokens(req.body);
    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/spotify/disconnect Disconnect Spotify.
   * @apiName disconnect
   * @apiGroup Spotify
   */
  async function disconnect(req, res) {
    await spotifyHandler.disconnect();
    res.json({
      success: true,
    });
  }

  /**
   * @api {get} /api/v1/service/spotify/discover Discover the Spotify Connect devices of the account.
   * @apiName discover
   * @apiGroup Spotify
   */
  async function discover(req, res) {
    const devices = await spotifyHandler.discoverDevices();
    res.json(devices);
  }

  /**
   * @api {get} /api/v1/service/spotify/player Get the current playback state.
   * @apiName getPlayer
   * @apiGroup Spotify
   */
  async function getPlayer(req, res) {
    const playback = await spotifyHandler.refreshPlaybackState();
    res.json(playback);
  }

  return {
    'get /api/v1/service/spotify/configuration': {
      authenticated: true,
      controller: asyncMiddleware(getConfiguration),
    },
    'post /api/v1/service/spotify/configuration': {
      authenticated: true,
      controller: asyncMiddleware(saveConfiguration),
    },
    'get /api/v1/service/spotify/status': {
      authenticated: true,
      controller: asyncMiddleware(getStatus),
    },
    'post /api/v1/service/spotify/connect': {
      authenticated: true,
      controller: asyncMiddleware(connect),
    },
    'post /api/v1/service/spotify/token': {
      authenticated: true,
      controller: asyncMiddleware(retrieveTokens),
    },
    'post /api/v1/service/spotify/disconnect': {
      authenticated: true,
      controller: asyncMiddleware(disconnect),
    },
    'get /api/v1/service/spotify/discover': {
      authenticated: true,
      controller: asyncMiddleware(discover),
    },
    'get /api/v1/service/spotify/player': {
      authenticated: true,
      controller: asyncMiddleware(getPlayer),
    },
  };
};
