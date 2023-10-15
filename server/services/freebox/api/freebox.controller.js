const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
// const { getAuthorizationStatus } = require('../lib/getAuthorizationStatus');

module.exports = function FreeboxController(freeboxManager) {
  /**
   * @api {get} /api/v1/service/freebox/discovery Discover Freebox on local network
   * @apiName DiscoverFreebox
   * @apiGroup Freebox
   */
  async function discoverFreebox(req, res) {
    const response = await freeboxManager.discoverFreebox();
    res.json(response);
  }

  /**
   * @api {post} /api/v1/service/freebox/connect Connect Freebox to Gladys
   * @apiName Connect to the Freebox
   * @apiGroup Freebox
   */
  async function connectFreebox(req, res) {
    const freebox = await freeboxManager.connectFreebox();
    res.json(freebox);
  }

  /**
   * @api {post} /api/v1/service/freebox/sessionToken Open Freebox session
   * @apiName Open Session
   * @apiGroup Freebox
   */
  async function getSessionToken(req, res) {
    const response = await freeboxManager.getSessionToken();
    res.json(response);
  }

  /**
   * @api {get} /api/v1/service/freebox/discover Retrieve freebox devices
   * @apiName discover devices
   * @apiGroup Freebox
   */
  async function discoverDevices(req, res) {
    const devices = await freeboxManager.discoverDevices();
    res.json(devices);
  }

  /**
   * @api {get} /api/v1/service/freebox/disconnect Disconnect Freebox from Gladys
   * @apiName Disconnect Freebox
   * @apiGroup Freebox
   */
  async function disconnectFreebox(req, res) {
    const response = await freeboxManager.disconnect();
    res.json(response);
  }

  /**
   * @api {post} /api/v1/service/freebox/restart Restart your Freebox 
   * @apiName Restart Freebox
   * @apiGroup Freebox
   */
  async function restartFreebox(req, res) {
    const response = await freeboxManager.restartFreebox();
    res.json(response);
  }

  return {
    'get /api/v1/service/freebox/discovery': {
      authenticated: true,
      controller: asyncMiddleware(discoverFreebox),
    },
    'post /api/v1/service/freebox/connect': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(connectFreebox),
    },
    'post /api/v1/service/freebox/sessionToken': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(getSessionToken),
    },
    'get /api/v1/service/freebox/discover': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(discoverDevices),
    },
    'get /api/v1/service/freebox/disconnect': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(disconnectFreebox),
    },
    'post /api/v1/service/freebox/restart': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(restartFreebox),
    },
  };
};
