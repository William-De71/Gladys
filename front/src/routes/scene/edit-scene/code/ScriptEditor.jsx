import { Component, createRef } from 'preact';
import { Localizer, Text } from 'preact-i18n';
import cx from 'classnames';

import { ACTIONS, CONDITION_ACTIONS } from '../../../../../../server/utils/constants';
import { completionSource } from './completions';
import editStyle from '../style.css';
import style from './code.css';

// A JavaScript editor for the scripts of the scene editor (docs/specs/scene-editor-modes.md D):
// the whole actions of a scene in the advanced mode, or a function block. It holds a toolbar
// (insert a device, an example, the API reference) and CodeMirror, loaded only when an editor is
// shown, so the rest of Gladys does not pay for it.

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
  { signature: "await gladys.store('name', value)", key: 'store' },
  { signature: 'await sleep(ms)', key: 'sleep' },
  { signature: 'stop()', key: 'stop' },
  { signature: 'console.log(…)', key: 'console' }
];

const SCENE_EXAMPLE = `// Example: turn the fan on when it is hot
const temperature = await gladys.device.getValue('living-room-temperature');
if (temperature > 26) {
  await gladys.device.setValue('living-room-fan', 1);
  await gladys.message.send('admin', \`It is \${temperature} °C, fan on\`);
}
`;

const FUNCTION_EXAMPLE = `// Example: the result is read by the next blocks as {{<path of this block>.result}}
const temperature = await gladys.device.getValue('living-room-temperature');
return temperature > 26 ? 'hot' : 'fine';
`;

// What `gladys.action` runs: every action but those whose logic is JavaScript itself
const flattenTypes = value => (typeof value === 'string' ? [value] : Object.values(value).flatMap(flattenTypes));
const SCRIPT_ONLY_ACTIONS = [ACTIONS.SCRIPT.RUN, ACTIONS.CONDITION.IF_THEN_ELSE, ACTIONS.CONDITION.WHILE];
const ACTION_TYPES = flattenTypes(ACTIONS)
  .filter(type => !SCRIPT_ONLY_ACTIONS.includes(type))
  .sort();

class ScriptEditor extends Component {
  editorContainer = createRef();

  state = { editorLoaded: false, editorError: false, showReference: false, featureToInsert: '' };

  componentDidMount() {
    this.mountEditor();
  }

  // The suggestions follow the devices of the instance (docs/specs/scene-editor-modes.md D.8)
  getCompletionData = () => ({
    features: Object.keys(this.props.deviceFeatures || {}).map(selector => {
      const { device, feature } = this.props.deviceFeatures[selector];
      return { selector, name: `${device.name} — ${feature.name || selector}` };
    }),
    actionTypes: ACTION_TYPES,
    conditionTypes: CONDITION_ACTIONS
  });

  mountEditor = async () => {
    try {
      const [{ EditorView, basicSetup }, { javascript, javascriptLanguage }] = await Promise.all([
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
          javascriptLanguage.data.of({ autocomplete: completionSource(this.getCompletionData) }),
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

  insertExample = () => this.insertText(this.props.functionBlock ? FUNCTION_EXAMPLE : SCENE_EXAMPLE);

  onTestClick = () => (this.props.testing ? this.props.onStopTest() : this.props.onTest());

  render(props, { editorLoaded, editorError, showReference, featureToInsert }) {
    const features = Object.keys(props.deviceFeatures || {})
      .map(selector => ({ selector, ...props.deviceFeatures[selector] }))
      .sort((a, b) => `${a.device.name}${a.feature.name}`.localeCompare(`${b.device.name}${b.feature.name}`));
    return (
      <div class={cx(style.codeEditor, { [style.functionEditor]: props.functionBlock })} data-cy={props.cy}>
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
          {props.onTest && (
            <Localizer>
              <button
                type="button"
                class={cx(editStyle.pill, props.testing ? editStyle.pillDanger : editStyle.pillAccent)}
                onClick={this.onTestClick}
                disabled={props.testStarting}
                title={<Text id="editScene.code.test.hint" />}
                data-cy="code-test"
              >
                <i class={`fe fe-${props.testing ? 'square' : 'play'}`} />{' '}
                <Text id={props.testing ? 'editScene.code.test.stop' : 'editScene.code.test.run'} />
              </button>
            </Localizer>
          )}
        </div>

        {showReference && (
          <div class={style.reference} data-cy="code-reference">
            <p class="text-muted mb-2">
              <Text id={props.functionBlock ? 'editScene.code.functionIntro' : 'editScene.code.referenceIntro'} />
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
      </div>
    );
  }
}

export default ScriptEditor;
