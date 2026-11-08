import { Text } from 'preact-i18n';
import cx from 'classnames';

import ScriptEditor from './ScriptEditor';
import editStyle from '../style.css';
import style from './code.css';

// The advanced mode of the scene editor (docs/specs/scene-editor-modes.md D): the actions of the
// scene are one script, with the console of what it logs while the scene runs.
const SceneCodeEditor = props => (
  <div class={style.codeEditor}>
    <ScriptEditor
      code={props.code}
      onChange={props.onChange}
      deviceFeatures={props.deviceFeatures}
      cy="scene-code-editor"
    />
    <div class={style.console} data-cy="code-console">
      <div class={style.consoleHeader}>
        <span>
          <i class="fe fe-terminal" /> <Text id="editScene.code.console" />
        </span>
        <button type="button" class={cx(editStyle.pill, editStyle.pillSmall)} onClick={props.clearScriptLogs}>
          <Text id="editScene.code.clearConsole" />
        </button>
      </div>
      <div class={style.consoleLines}>
        {props.scriptLogs.length === 0 && (
          <div class="text-muted">
            <Text id="editScene.code.emptyConsole" />
          </div>
        )}
        {props.scriptLogs.map(log => (
          <div key={log.id} class={cx(style.consoleLine, style[`level-${log.level}`])}>
            <span class={style.consoleTime}>{log.time}</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SceneCodeEditor;
