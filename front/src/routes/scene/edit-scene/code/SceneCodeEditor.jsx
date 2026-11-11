import ScriptWorkbench from './ScriptWorkbench';

// The advanced mode of the scene editor (docs/specs/scene-editor-modes.md D): the actions of the
// scene are one script, with the console of what it logs while the scene runs or is tried.
const SceneCodeEditor = props => (
  <ScriptWorkbench
    code={props.code}
    onChange={props.onChange}
    deviceFeatures={props.deviceFeatures}
    sceneSelector={props.sceneSelector}
    cy="scene-code-editor"
  />
);

export default SceneCodeEditor;
