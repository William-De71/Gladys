import { Component } from 'preact';
import { Text } from 'preact-i18n';
import cx from 'classnames';

import style from './style.css';

// A confirmation in the look of the editor (Horizon glass), instead of the browser's dialog.
// Escape cancels, Enter confirms.
class ConfirmDialog extends Component {
  onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.props.onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.props.onConfirm();
    }
  };

  onBackdropClick = event => {
    if (event.target === event.currentTarget) {
      this.props.onCancel();
    }
  };

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
    if (this.confirmButton) {
      this.confirmButton.focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  setConfirmButton = element => {
    this.confirmButton = element;
  };

  render({ titleId, messageId, confirmLabelId, danger, onConfirm, onCancel }) {
    return (
      <div class={style.confirmBackdrop} onClick={this.onBackdropClick} data-cy="confirm-dialog">
        <div class={style.confirmDialog} role="alertdialog" aria-modal="true">
          <span class={cx(style.confirmIcon, { [style.confirmIconDanger]: danger })}>
            <i class={danger ? 'fe fe-alert-triangle' : 'fe fe-help-circle'} />
          </span>
          <div class={style.confirmTitle}>
            <Text id={titleId} />
          </div>
          <div class={style.confirmMessage}>
            <Text id={messageId} />
          </div>
          <div class={style.confirmActions}>
            <button type="button" class={style.pill} onClick={onCancel} data-cy="confirm-dialog-cancel">
              <Text id="editScene.cancelButton" />
            </button>
            <button
              type="button"
              ref={this.setConfirmButton}
              class={cx(style.pill, danger ? style.pillDanger : style.pillDark)}
              onClick={onConfirm}
              data-cy="confirm-dialog-confirm"
            >
              <Text id={confirmLabelId} />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ConfirmDialog;
