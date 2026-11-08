import { Localizer, Text } from 'preact-i18n';
import cx from 'classnames';

import style from './style.css';

// Classic · Graph · Code (docs/specs/scene-editor-modes.md E): a frosted segmented pill, like the
// other header controls of the editor
const MODES = [
  { mode: 'classic', icon: 'list' },
  { mode: 'graph', icon: 'share-2' },
  { mode: 'code', icon: 'code' }
];

const EditorModeSwitch = ({ editorMode, switchEditorMode, disabled, fullWidth }) => (
  <div
    class={cx(style.editorModeSwitch, { [style.editorModeSwitchFull]: fullWidth })}
    role="group"
    data-cy={fullWidth ? 'editor-mode-switch-mobile' : 'editor-mode-switch'}
  >
    {MODES.map(({ mode, icon }) => (
      <Localizer key={mode}>
        <button
          type="button"
          class={cx(style.editorModeButton, { [style.editorModeButtonActive]: editorMode === mode })}
          onClick={() => switchEditorMode(mode)}
          disabled={disabled}
          aria-pressed={editorMode === mode}
          aria-label={<Text id={`editScene.modes.${mode}`} />}
          data-cy={fullWidth ? `editor-mode-mobile-${mode}` : `editor-mode-${mode}`}
        >
          <i class={`fe fe-${icon}`} />
          <span class={style.editorModeLabel}>
            <Text id={`editScene.modes.${mode}`} />
          </span>
        </button>
      </Localizer>
    ))}
  </div>
);

export default EditorModeSwitch;
