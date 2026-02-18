const asyncMiddleware = require('../middlewares/asyncMiddleware');

module.exports = function EventLogController(gladys) {
  /**
   * @api {get} /api/v1/event_log get
   * @apiName get
   * @apiGroup EventLog
   */
  async function get(req, res) {
    const eventLogs = await gladys.eventLog.get(req.query);
    res.json(eventLogs);
  }

  /**
   * @api {post} /api/v1/event_log create
   * @apiName create
   * @apiGroup EventLog
   */
  async function create(req, res) {
    const eventLog = await gladys.eventLog.create(
      req.body.type,
      req.body.message,
      req.body.icon,
      req.body.data,
    );
    res.status(201).json(eventLog);
  }

  /**
   * @api {post} /api/v1/event_log/purge purge
   * @apiName purge
   * @apiGroup EventLog
   */
  async function purge(req, res) {
    const deleted = await gladys.eventLog.purge();
    res.json({ deleted });
  }

  return Object.freeze({
    get: asyncMiddleware(get),
    create: asyncMiddleware(create),
    purge: asyncMiddleware(purge),
  });
};
