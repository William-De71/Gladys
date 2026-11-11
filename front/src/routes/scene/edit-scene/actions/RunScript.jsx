import { Component } from 'preact';
import { Text } from 'preact-i18n';
import get from 'get-value';

import withIntlAsProp from '../../../../utils/withIntlAsProp';
import ScriptWorkbench from '../code/ScriptWorkbench';

// A function block (docs/specs/scene-editor-modes.md D.6): JavaScript run in the sandbox of the
// advanced mode, in the middle of a block scene. What it returns is a variable of the next blocks.
class RunScript extends Component {
  updateCode = code => this.props.updateActionProperty(this.props.path, 'code', code);

  declareResult = () => {
    this.props.setVariables(this.props.path, [
      {
        name: 'result',
        type: 'script',
        ready: true,
        label: get(this.props.intl.dictionary, 'editScene.variables.runScript.result'),
        data: {}
      }
    ]);
  };

  componentDidMount() {
    this.declareResult();
  }

  render(props) {
    return (
      <div>
        <p class="text-muted">
          <Text id="editScene.actionsCard.runScript.description" />
        </p>
        <ScriptWorkbench
          code={props.action.code || ''}
          onChange={this.updateCode}
          deviceFeatures={props.deviceFeatures}
          sceneSelector={props.scene && props.scene.selector}
          functionBlock
          cy="function-block-editor"
        />
      </div>
    );
  }
}

export default withIntlAsProp(RunScript);
