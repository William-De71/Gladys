import { Localizer, Text } from 'preact-i18n';
import cx from 'classnames';

import style from './style.css';

// Classic · Graph · Code (docs/specs/scene-editor-modes.md E)
const MODES = [
  { mode: 'classic', icon: 'list' },
  { mode: 'graph', icon: 'share-2' },
  { mode: 'code', icon: 'code' }
];

const EditorModeSwitch = ({ editorMode, switchEditorMode, disabled }) => (
  <div class={cx('btn-group', style.editorModeSwitch)} role="group" data-cy="editor-mode-switch">
    {MODES.map(({ mode, icon }) => (
      <Localizer key={mode}>
        <button
          type="button"
          class={cx('btn btn-sm', editorMode === mode ? 'btn-primary' : 'btn-outline-primary')}
          onClick={() => switchEditorMode(mode)}
          disabled={disabled}
          aria-pressed={editorMode === mode}
          aria-label={<Text id={`editScene.modes.${mode}`} />}
          data-cy={`editor-mode-${mode}`}
        >
          <i class={`fe fe-${icon}`} />
          <span class={style.editorModeLabel}>
            {' '}
            <Text id={`editScene.modes.${mode}`} />
          </span>
        </button>
      </Localizer>
    ))}
  </div>
);

export default EditorModeSwitch;
