const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');

module.exports = function ThermostatController(thermostatHandler) {
  /**
   * @api {get} /api/v1/service/thermostat/device Get thermostat devices
   * @apiName getDevices
   * @apiGroup Thermostat
   */
  async function getDevices(req, res) {
    const devices = await thermostatHandler.getDevices();
    res.json(devices);
  }

  /**
   * @api {post} /api/v1/service/thermostat/device Create thermostat device
   * @apiName createDevice
   * @apiGroup Thermostat
   */
  async function createDevice(req, res) {
    const device = await thermostatHandler.createDevice(req.body);
    res.json(device);
  }

  return {
    'get /api/v1/service/thermostat/device': {
      authenticated: true,
      controller: asyncMiddleware(getDevices),
    },
    'post /api/v1/service/thermostat/device': {
      authenticated: true,
      controller: asyncMiddleware(createDevice),
    },
  };
};
