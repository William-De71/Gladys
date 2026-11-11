import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import cx from 'classnames';

import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../server/utils/constants';
import { parseSaveError, PROBLEMS } from '../saveErrors';
import ScriptEditor from './ScriptEditor';
import editStyle from '../style.css';
import style from './code.css';

const MAX_SCRIPT_LOGS = 200;

// A script editor with its console and its "Try" button (docs/specs/scene-editor-modes.md D.5 and
// D.7): the script of a scene in the advanced mode, or a function block. The console shows what
// the scripts of the scene log, whether the scene runs or the code is being tried.
class ScriptWorkbench extends Component {
  state = { logs: [], executionId: null, starting: false };

  logCounter = 0;

  addLog = log => {
    this.logCounter += 1;
    const line = { id: this.logCounter, time: new Date().toLocaleTimeString(), level: 'info', ...log };
    this.setState(prevState => ({ logs: [...prevState.logs, line].slice(-MAX_SCRIPT_LOGS) }));
  };

  onScriptLog = payload => {
    if (payload && payload.sceneSelector === this.props.sceneSelector) {
      this.addLog({ level: payload.level, message: payload.message });
    }
  };

  // A short script may finish before the answer that names its execution: its end is kept until
  // the execution is known
  earlyEnds = {};

  onTestFinished = payload => {
    if (!payload || payload.sceneSelector !== this.props.sceneSelector) {
      return;
    }
    if (payload.executionId === this.state.executionId) {
      this.reportEnd(payload);
    } else if (this.state.starting) {
      this.earlyEnds[payload.executionId] = payload;
    }
  };

  reportEnd = payload => {
    this.setState({ executionId: null });
    if (payload.status === 'success' && payload.result !== null && payload.result !== undefined) {
      this.addLog({
        textId: 'editScene.code.test.successWithResult',
        fields: { result: JSON.stringify(payload.result) }
      });
    } else {
      this.addLog({
        textId: `editScene.code.test.${payload.status}`,
        level: payload.status === 'error' ? 'error' : 'info'
      });
    }
  };

  test = async () => {
    this.earlyEnds = {};
    this.setState({ starting: true });
    this.addLog({ textId: 'editScene.code.test.started' });
    try {
      const execution = await this.props.httpClient.post(`/api/v1/scene/${this.props.sceneSelector}/script/test`, {
        code: this.props.code
      });
      const earlyEnd = this.earlyEnds[execution.execution_id];
      if (earlyEnd) {
        this.reportEnd(earlyEnd);
      } else {
        this.setState({ executionId: execution.execution_id });
      }
    } catch (e) {
      console.error(e);
      const syntax = parseSaveError(e.response && e.response.data).find(problem => problem.problem === PROBLEMS.SYNTAX);
      if (syntax) {
        this.addLog({
          level: 'error',
          textId: syntax.line === null ? 'editScene.code.test.syntaxError' : 'editScene.code.test.syntaxErrorAt',
          fields: { line: syntax.line, column: syntax.column, reason: syntax.reason }
        });
      } else {
        this.addLog({ level: 'error', textId: 'editScene.code.test.failed' });
      }
    }
    this.setState({ starting: false });
  };

  stopTest = async () => {
    try {
      await this.props.httpClient.post(`/api/v1/scene/execution/${this.state.executionId}/stop`);
    } catch (e) {
      console.error(e);
    }
  };

  clearLogs = () => this.setState({ logs: [] });

  componentDidMount() {
    const { dispatcher } = this.props.session;
    dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_LOG, this.onScriptLog);
    dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_TEST_FINISHED, this.onTestFinished);
  }

  componentWillUnmount() {
    const { dispatcher } = this.props.session;
    dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_LOG, this.onScriptLog);
    dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_TEST_FINISHED, this.onTestFinished);
  }

  render(props, { logs, executionId, starting }) {
    // a function block keeps its card small: its console only shows once there is something in it
    const showConsole = !props.functionBlock || logs.length > 0;
    return (
      <div class={style.codeEditor}>
        <ScriptEditor
          code={props.code}
          onChange={props.onChange}
          deviceFeatures={props.deviceFeatures}
          functionBlock={props.functionBlock}
          cy={props.cy}
          onTest={props.sceneSelector ? this.test : null}
          onStopTest={this.stopTest}
          testing={executionId !== null}
          testStarting={starting}
        />
        {showConsole && (
          <div class={style.console} data-cy="code-console">
            <div class={style.consoleHeader}>
              <span>
                <i class="fe fe-terminal" /> <Text id="editScene.code.console" />
              </span>
              <button type="button" class={cx(editStyle.pill, editStyle.pillSmall)} onClick={this.clearLogs}>
                <Text id="editScene.code.clearConsole" />
              </button>
            </div>
            <div class={style.consoleLines}>
              {logs.length === 0 && (
                <div class="text-muted">
                  <Text id="editScene.code.emptyConsole" />
                </div>
              )}
              {logs.map(log => (
                <div key={log.id} class={cx(style.consoleLine, style[`level-${log.level}`])}>
                  <span class={style.consoleTime}>{log.time}</span>{' '}
                  {log.textId ? <Text id={log.textId} fields={log.fields} /> : log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default connect('httpClient,session', {})(ScriptWorkbench);
