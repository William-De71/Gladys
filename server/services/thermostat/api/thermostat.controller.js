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
   * @api {patch} /api/v1/service/thermostat/schedule/:selector Update a schedule
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

  /**
   * @api {post} /api/v1/service/thermostat/setpoint/:feature_selector Set thermostat setpoint
   * @apiName setSetpoint
   * @apiGroup Thermostat
   */
  async function setSetpoint(req, res) {
    const featureSelector = req.params.feature_selector;
    const value = Number(req.body.value);
    if (!Number.isFinite(value)) {
      res.status(400).json({ error: 'INVALID_VALUE' });
      return;
    }
    const deviceFeature = thermostatHandler.gladys.stateManager.get('deviceFeature', featureSelector);
    if (!deviceFeature) {
      res.status(404).json({ error: 'FEATURE_NOT_FOUND' });
      return;
    }
    await thermostatHandler.gladys.device.saveState(deviceFeature, value);
    thermostatHandler.triggerApplySchedules();
    res.json({ success: true, value });
  }

  /**
   * @api {post} /api/v1/service/thermostat/variable/:variable_key Set a thermostat variable
   * @apiName setVariable
   * @apiGroup Thermostat
   * @apiDescription Sets a THERMOSTAT_* variable, broadcasts the matching websocket
   * message and schedules an immediate regulation pass.
   */
  async function setVariable(req, res) {
    if (!req.params.variable_key || !req.params.variable_key.startsWith('THERMOSTAT_')) {
      res.status(400).json({ error: 'INVALID_VARIABLE_KEY' });
      return;
    }
    const variable = await thermostatHandler.setVariable(req.params.variable_key, req.body.value);
    res.json(variable);
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
    'patch /api/v1/service/thermostat/schedule/:selector': {
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
    'post /api/v1/service/thermostat/variable/:variable_key': {
      authenticated: true,
      controller: asyncMiddleware(setVariable),
    },
  };
};
