const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');

module.exports = function ThermostatController(thermostatHandler) {
  /**
   * @api {get} /api/v1/service/thermostat/device Get thermostat devices
   * @apiName getDevices
   * @apiGroup Thermostat
   */
  async function getDevices(req, res) {
    const devices = await thermostatHandler.getDevices({
      search: req.query.search,
      order_dir: req.query.order_dir,
    });
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

  /**
   * @api {get} /api/v1/service/thermostat/schedule Get all schedules
   * @apiName getSchedules
   * @apiGroup Thermostat
   */
  async function getSchedules(req, res) {
    const schedules = await thermostatHandler.getSchedules();
    res.json(schedules);
  }

  /**
   * @api {post} /api/v1/service/thermostat/schedule Create a schedule
   * @apiName createSchedule
   * @apiGroup Thermostat
   */
  async function createSchedule(req, res) {
    const schedule = await thermostatHandler.createSchedule(req.body);
    res.json(schedule);
  }

  /**
   * @api {put} /api/v1/service/thermostat/schedule/:selector Update a schedule
   * @apiName updateSchedule
   * @apiGroup Thermostat
   */
  async function updateSchedule(req, res) {
    const schedule = await thermostatHandler.updateSchedule(req.params.selector, req.body);
    res.json(schedule);
  }

  /**
   * @api {delete} /api/v1/service/thermostat/schedule/:selector Delete a schedule
   * @apiName deleteSchedule
   * @apiGroup Thermostat
   */
  async function deleteSchedule(req, res) {
    await thermostatHandler.deleteSchedule(req.params.selector);
    res.json({ success: true });
  }

  async function setSetpoint(req, res) {
    const featureSelector = req.params.feature_selector;
    const value = Number(req.body.value);
    const deviceFeature = thermostatHandler.gladys.stateManager.get('deviceFeature', featureSelector);
    if (!deviceFeature) {
      res.status(404).json({ error: 'FEATURE_NOT_FOUND' });
      return;
    }
    await thermostatHandler.gladys.device.saveState(deviceFeature, value);
    res.json({ success: true, value });
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
    'get /api/v1/service/thermostat/schedule': {
      authenticated: true,
      controller: asyncMiddleware(getSchedules),
    },
    'post /api/v1/service/thermostat/schedule': {
      authenticated: true,
      controller: asyncMiddleware(createSchedule),
    },
    'put /api/v1/service/thermostat/schedule/:selector': {
      authenticated: true,
      controller: asyncMiddleware(updateSchedule),
    },
    'delete /api/v1/service/thermostat/schedule/:selector': {
      authenticated: true,
      controller: asyncMiddleware(deleteSchedule),
    },
    'post /api/v1/service/thermostat/setpoint/:feature_selector': {
      authenticated: true,
      controller: asyncMiddleware(setSetpoint),
    },
  };
};
