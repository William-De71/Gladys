const asyncMiddleware = require('../middlewares/asyncMiddleware');
const { generateScript } = require('../../lib/scene/script/script.generate');
const { BadParameters } = require('../../utils/coreErrors');
const { EVENTS, ACTIONS, ACTIONS_STATUS } = require('../../utils/constants');

/**
 * @apiDefine SceneParam
 * @apiParamExample {json} Request-Example:
 *  {
 *    "name": "New Scene",
 *    "actions": [{
 *      "type": "house.arm",
 *      "house": "main-house",
 *     }],
 *  }
 */

module.exports = function SceneController(gladys) {
  /**
   * @api {post} /api/v1/scene create
   * @apiName create
   * @apiGroup Scene
   * @apiUse SceneParam
   */
  async function create(req, res) {
    const newScene = await gladys.scene.create(req.body);
    res.status(201).json(newScene);
  }

  /**
   * @api {patch} /api/v1/scene/:scene_selector update
   * @apiName update
   * @apiGroup Scene
   * @apiUse SceneParam
   */
  async function update(req, res) {
    const newScene = await gladys.scene.update(req.params.scene_selector, req.body);
    res.json(newScene);
  }

  /**
   * @api {get} /api/v1/scene get
   * @apiName get
   * @apiGroup Scene
   */
  async function get(req, res) {
    const scenes = await gladys.scene.get(req.query);
    res.json(scenes);
  }

  /**
   * @api {get} /api/v1/scene/running get running
   * @apiName getRunning
   * @apiGroup Scene
   */
  async function getRunning(req, res) {
    const runningScenes = gladys.scene.getRunning();
    res.json(runningScenes);
  }

  /**
   * @api {get} /api/v1/scene/:scene_selector get by selector
   * @apiName getBySelector
   * @apiGroup Scene
   */
  async function getBySelector(req, res) {
    const scene = await gladys.scene.getBySelector(req.params.scene_selector);
    res.json(scene);
  }

  /**
   * @api {delete} /api/v1/scene/:scene_selector delete
   * @apiName delete
   * @apiGroup Scene
   */
  async function destroy(req, res) {
    await gladys.scene.destroy(req.params.scene_selector);
    res.json({
      success: true,
    });
  }

  /**
   * @api {post} /api/v1/scene/:scene_selector/start start
   * @apiName start
   * @apiGroup Scene
   */
  async function start(req, res) {
    const action = {
      type: ACTIONS.SCENE.START,
      scene: req.params.scene_selector,
      status: ACTIONS_STATUS.PENDING,
    };
    gladys.event.emit(EVENTS.ACTION.TRIGGERED, action);
    res.json(action);
  }

  /**
   * @api {post} /api/v1/scene/execution/:execution_id/stop stop execution
   * @apiName stopExecution
   * @apiGroup Scene
   */
  async function stopExecution(req, res) {
    const stopped = gladys.scene.stop(req.params.execution_id);
    res.json({ success: stopped });
  }

  /**
   * @api {post} /api/v1/scene/:scene_selector/stop stop
   * @apiName stop
   * @apiGroup Scene
   */
  async function stop(req, res) {
    const stopped = gladys.scene.stopBySelector(req.params.scene_selector);
    res.json({ success: stopped > 0, stopped });
  }

  /**
   * @api {post} /api/v1/scene/:scene_selector/duplicate duplicate
   * @apiName duplicate
   * @apiGroup Scene
   */
  async function duplicate(req, res) {
    const scene = await gladys.scene.duplicate(req.params.scene_selector, req.body.name, req.body.icon);
    res.json(scene);
  }

  /**
   * @api {get} /api/v1/tag_scene get
   * @apiName get
   * @apiGroup TagScene
   */
  async function getTag(req, res) {
    const tags = await gladys.scene.getTag();
    res.json(tags);
  }

  /**
   * @api {post} /api/v1/scene/script/generate generate a script
   * @apiName generateScript
   * @apiGroup Scene
   * @apiDescription Convert the steps of a scene to a script with the same behavior
   * (docs/specs/scene-editor-modes.md D.4).
   * @apiBody {Array} actions The steps of the scene.
   * @apiSuccessExample {json} Success-Response:
   * { "code": "await gladys.action('light.turn-on', { devices: ['lamp'] });\n" }
   */
  async function generateSceneScript(req, res) {
    if (!req.body || !Array.isArray(req.body.actions)) {
      throw new BadParameters('"actions" must be an array of steps');
    }
    res.json({ code: generateScript(req.body.actions) });
  }

  return Object.freeze({
    create: asyncMiddleware(create),
    generateScript: asyncMiddleware(generateSceneScript),
    destroy: asyncMiddleware(destroy),
    get: asyncMiddleware(get),
    getRunning: asyncMiddleware(getRunning),
    getBySelector: asyncMiddleware(getBySelector),
    update: asyncMiddleware(update),
    start: asyncMiddleware(start),
    stop: asyncMiddleware(stop),
    stopExecution: asyncMiddleware(stopExecution),
    duplicate: asyncMiddleware(duplicate),
    getTag: asyncMiddleware(getTag),
  });
};
