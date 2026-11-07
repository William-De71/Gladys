const { BadParameters } = require('../../../utils/coreErrors');
const { isScriptActions } = require('../../../models/scene');
const { compileScript } = require('./script.sandbox');

/**
 * @description Refuse the actions of a scene in code mode whose script does not compile
 * (docs/specs/scene-editor-modes.md B.3): a scene is never saved in a state where it cannot run.
 * Other actions are left to the model validation.
 * @param {Array} actions - The actions about to be saved.
 * @returns {Promise} Resolve when the actions can be saved.
 * @example
 * await assertScriptCompiles([[{ type: 'script.run', code: 'await sleep(1000);' }]]);
 */
async function assertScriptCompiles(actions) {
  if (!isScriptActions(actions)) {
    return;
  }
  const result = await compileScript(actions[0][0].code || '');
  if (!result.valid) {
    const position = result.line === null ? '' : ` at line ${result.line}, column ${result.column}`;
    throw new BadParameters(`Script syntax error${position}: ${result.message}`);
  }
}

module.exports = {
  assertScriptCompiles,
};
