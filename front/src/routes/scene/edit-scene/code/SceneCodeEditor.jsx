import { Component, createRef } from 'preact';
import { Localizer, Text } from 'preact-i18n';
import cx from 'classnames';

import editStyle from '../style.css';
import style from './code.css';

// The code mode of the scene editor (docs/specs/scene-editor-modes.md D): the actions of the scene
// are one script. CodeMirror is loaded only here, so the other modes do not pay for it.

// The API of D.3, as shown in the reference panel. The descriptions are translated.
const API_REFERENCE = [
  { signature: 'event', key: 'event' },
  { signature: "await gladys.device.getValue('feature')", key: 'getValue' },
  { signature: "await gladys.device.getFeature('feature')", key: 'getFeature' },
  { signature: "await gladys.device.setValue('feature', value)", key: 'setValue' },
  { signature: "await gladys.scene.start('scene')", key: 'startScene' },
  { signature: "await gladys.message.send('user', 'text')", key: 'sendMessage' },
  { signature: "await gladys.action('type', { …params }, { saveAs })", key: 'action' },
  { signature: "await gladys.check('type', { …params })", key: 'check' },
  { signature: 'await sleep(ms)', key: 'sleep' },
  { signature: 'stop()', key: 'stop' },
  { signature: 'console.log(…)', key: 'console' }
];

const EXAMPLE = `// Example: turn the fan on when it is hot
const temperature = await gladys.device.getValue('living-room-temperature');
if (temperature > 26) {
  await gladys.device.setValue('living-room-fan', 1);
  await gladys.message.send('admin', \`It is \${temperature} °C, fan on\`);
}
`;

class SceneCodeEditor extends Component {
  editorContainer = createRef();

  state = { editorLoaded: false, editorError: false, showReference: false, featureToInsert: '' };

  componentDidMount() {
    this.mountEditor();
  }

  mountEditor = async () => {
    try {
      const [{ EditorView, basicSetup }, { javascript }] = await Promise.all([
        import('codemirror'),
        import('@codemirror/lang-javascript')
      ]);
      if (!this.editorContainer.current) {
        return;
      }
      this.editorView = new EditorView({
        doc: this.props.code,
        extensions: [
          basicSetup,
          javascript(),
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              this.lastEmitted = update.state.doc.toString();
              this.props.onChange(this.lastEmitted);
            }
          })
        ],
        parent: this.editorContainer.current
      });
      this.setState({ editorLoaded: true });
    } catch (e) {
      console.error(e);
      this.setState({ editorError: true });
    }
  };

  componentDidUpdate() {
    // The code changed from outside (conversion from blocks, undo of a save): show it
    if (
      this.editorView &&
      this.props.code !== this.lastEmitted &&
      this.props.code !== this.editorView.state.doc.toString()
    ) {
      this.editorView.dispatch({
        changes: { from: 0, to: this.editorView.state.doc.length, insert: this.props.code }
      });
    }
  }

  componentWillUnmount() {
    if (this.editorView) {
      this.editorView.destroy();
    }
  }

  insertText = text => {
    if (this.editorView) {
      const { from, to } = this.editorView.state.selection.main;
      this.editorView.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      this.editorView.focus();
    } else {
      this.props.onChange(`${this.props.code}${text}`);
    }
  };

  onTextareaInput = e => this.props.onChange(e.target.value);

  selectFeature = e => {
    const selector = e.target.value;
    if (selector) {
      this.insertText(`'${selector}'`);
    }
    this.setState({ featureToInsert: '' });
  };

  toggleReference = () => this.setState(prevState => ({ showReference: !prevState.showReference }));

  insertExample = () => this.insertText(EXAMPLE);

  render(props, { editorLoaded, editorError, showReference, featureToInsert }) {
    const features = Object.keys(props.deviceFeatures || {})
      .map(selector => ({ selector, ...props.deviceFeatures[selector] }))
      .sort((a, b) => `${a.device.name}${a.feature.name}`.localeCompare(`${b.device.name}${b.feature.name}`));
    return (
      <div class={style.codeEditor} data-cy="scene-code-editor">
        <div class={style.toolbar}>
          <select
            class="custom-select"
            value={featureToInsert}
            onChange={this.selectFeature}
            data-cy="code-insert-feature"
          >
            <Localizer>
              <option value="">{<Text id="editScene.code.insertFeature" />}</option>
            </Localizer>
            {features.map(({ selector, device, feature }) => (
              <option value={selector} key={selector}>
                {device.name} — {feature.name || selector}
              </option>
            ))}
          </select>
          <button type="button" class={editStyle.pill} onClick={this.insertExample}>
            <i class="fe fe-file-text" /> <Text id="editScene.code.insertExample" />
          </button>
          <button
            type="button"
            class={cx(editStyle.pill, { [editStyle.pillAccent]: showReference })}
            onClick={this.toggleReference}
            data-cy="code-toggle-reference"
          >
            <i class="fe fe-book-open" /> <Text id="editScene.code.reference" />
          </button>
        </div>

        {showReference && (
          <div class={style.reference} data-cy="code-reference">
            <p class="text-muted mb-2">
              <Text id="editScene.code.referenceIntro" />
            </p>
            <table class="table table-sm mb-0">
              <tbody>
                {API_REFERENCE.map(entry => (
                  <tr key={entry.key}>
                    <td>
                      <code>{entry.signature}</code>
                    </td>
                    <td>
                      <Text id={`editScene.code.api.${entry.key}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CodeMirror owns this element: Preact never renders into it */}
        <div class={cx(style.editor, { 'd-none': !editorLoaded })} ref={this.editorContainer} />
        {!editorLoaded && (
          <div class={style.editor}>
            {/* until CodeMirror is loaded, or if it cannot be */}
            <textarea
              class={cx('form-control', style.fallback)}
              value={props.code}
              onInput={this.onTextareaInput}
              spellcheck={false}
              readOnly={!editorError}
              data-cy="code-fallback"
            />
          </div>
        )}

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
  }
}

export default SceneCodeEditor;
