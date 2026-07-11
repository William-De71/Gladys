import { Component, createRef } from 'preact';
import cx from 'classnames';
import iro from '@jaames/iro';

import { intToHex, hexToInt } from '../../../../server/utils/colors';

import style from './ColorPickerPopover.css';

const PRESET_COLORS = [
  '#FF0000',
  '#FF4500',
  '#FF8C00',
  '#FFD700',
  '#FFFF00',
  '#7FFF00',
  '#00FF00',
  '#00FA9A',
  '#00FFFF',
  '#00BFFF',
  '#0000FF',
  '#8A2BE2',
  '#FF00FF',
  '#FF69B4',
  '#FF8912',
  '#FFA757',
  '#FFB46B',
  '#FFD1A3',
  '#FFE4CE',
  '#FFFFFF'
];

// Without the Popover API there is no top-layer: the picker degrades to an
// in-flow panel toggled through component state (dark-mode colors then stay
// filtered, as before this component existed).
const POPOVER_SUPPORTED = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

const POPOVER_DEFAULT_WIDTH = 300;

let popoverIdCounter = 0;

class ColorPickerPopover extends Component {
  popoverId = `gladys-color-picker-${++popoverIdCounter}`;
  colorPickerRef = createRef();
  popoverRef = createRef();
  buttonRef = createRef();
  swatchOverlayRef = createRef();
  rafId = null;

  componentDidMount() {
    this.colorPicker = new iro.ColorPicker(this.colorPickerRef.current, {
      width: 150,
      color: this.getHexValue(),
      layout: [
        {
          component: iro.ui.Wheel,
          options: {}
        }
      ]
    });
    this.colorPicker.on('input:end', this.updateValue);

    if (!POPOVER_SUPPORTED) {
      return;
    }

    this.popoverRef.current.addEventListener('toggle', this.handleToggle);
    this.showSwatchOverlay();
    window.addEventListener('resize', this.scheduleReposition);
    window.addEventListener('scroll', this.scheduleReposition, true);
    if (typeof ResizeObserver === 'function') {
      // Catches layout shifts that move the button without any scroll/resize
      // event (charts loading, activity groups expanding above the row...).
      this.bodyResizeObserver = new ResizeObserver(this.scheduleReposition);
      this.bodyResizeObserver.observe(document.body);
    }
  }

  componentDidUpdate(previousProps) {
    const { value } = this.props;
    if (previousProps.value !== value && Number.isInteger(value) && this.colorPicker) {
      this.colorPicker.color.hexString = `#${intToHex(value)}`;
    }
    this.scheduleReposition();
  }

  componentWillUnmount() {
    if (this.popoverRef.current) {
      this.popoverRef.current.removeEventListener('toggle', this.handleToggle);
    }
    window.removeEventListener('resize', this.scheduleReposition);
    window.removeEventListener('scroll', this.scheduleReposition, true);
    if (this.bodyResizeObserver) {
      this.bodyResizeObserver.disconnect();
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (POPOVER_SUPPORTED && this.swatchOverlayRef.current) {
      try {
        this.swatchOverlayRef.current.hidePopover();
      } catch (e) {
        // ignore: popover not open
      }
    }
  }

  getHexValue = () => {
    const { value } = this.props;
    return Number.isInteger(value) ? `#${intToHex(value)}` : undefined;
  };

  scheduleReposition = () => {
    if (!POPOVER_SUPPORTED || this.rafId !== null) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.positionPopover();
      this.positionSwatchOverlay();
    });
  };

  showSwatchOverlay = () => {
    const ov = this.swatchOverlayRef.current;
    if (!ov) {
      return;
    }
    try {
      ov.showPopover();
    } catch (e) {
      // ignore: already shown
    }
    this.positionSwatchOverlay();
  };

  // The top-layer overlay paints above every z-index based UI (dropdowns,
  // menus), so hide it whenever its button is covered or has no layout.
  isButtonVisible = rect => {
    const btn = this.buttonRef.current;
    // The overlay itself has pointer-events: none, so elementFromPoint skips it.
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return el === btn || (el !== null && btn.contains(el));
  };

  positionSwatchOverlay = () => {
    const ov = this.swatchOverlayRef.current;
    const btn = this.buttonRef.current;
    if (!ov || !btn || !ov.matches(':popover-open')) {
      return;
    }
    const rect = btn.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.isButtonVisible(rect)) {
      ov.style.visibility = 'hidden';
      return;
    }
    ov.style.visibility = '';
    ov.style.top = `${rect.top + 2}px`;
    ov.style.left = `${rect.left + 2}px`;
    ov.style.width = `${rect.width - 4}px`;
    ov.style.height = `${rect.height - 4}px`;
  };

  positionPopover = () => {
    const pop = this.popoverRef.current;
    const btn = this.buttonRef.current;
    if (!pop || !btn || !pop.matches(':popover-open')) {
      return;
    }
    const row = btn.closest('tr');
    const rect = (row || btn).getBoundingClientRect();
    const width = row ? rect.width : Math.min(POPOVER_DEFAULT_WIDTH, window.innerWidth - 16);
    pop.style.width = `${width}px`;
    pop.style.top = `${rect.bottom + 4}px`;
    pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  };

  handleToggle = event => {
    if (event.newState === 'open') {
      this.positionPopover();
    }
  };

  updateValue = color => {
    this.props.updateValue(hexToInt(color.hexString));
  };

  selectPresetColor = hex => {
    this.colorPicker.color.hexString = hex;
    this.updateValue(this.colorPicker.color);
  };

  toggleFallback = () => {
    this.setState({ fallbackOpen: !this.state.fallbackOpen });
  };

  closePopover = () => {
    if (!POPOVER_SUPPORTED) {
      this.setState({ fallbackOpen: false });
      return;
    }
    try {
      this.popoverRef.current.hidePopover();
    } catch (e) {
      // ignore: popover not open
    }
  };

  render({}, { fallbackOpen }) {
    const color = this.getHexValue();

    return (
      <div>
        <button
          ref={this.buttonRef}
          popovertarget={POPOVER_SUPPORTED ? this.popoverId : undefined}
          onClick={POPOVER_SUPPORTED ? undefined : this.toggleFallback}
          class="btn py-2 border-1 border-dark"
          style={{ backgroundColor: color }}
          type="button"
        />
        {POPOVER_SUPPORTED && (
          <div
            ref={this.swatchOverlayRef}
            popover="manual"
            class={style.colorSwatchOverlay}
            style={{ backgroundColor: color }}
          />
        )}
        <div
          ref={this.popoverRef}
          id={this.popoverId}
          popover={POPOVER_SUPPORTED ? 'auto' : undefined}
          class={cx(style.colorPickerPopover, {
            [style.colorPickerFallback]: !POPOVER_SUPPORTED,
            'd-none': !POPOVER_SUPPORTED && !fallbackOpen
          })}
        >
          <div class={style.popoverHeader}>
            <button type="button" class={style.popoverClose} onClick={this.closePopover} aria-label="Close">
              &times;
            </button>
          </div>
          <div class={style.colorWheelContainer}>
            <div ref={this.colorPickerRef} />
          </div>
          <div class={style.colorPalette}>
            {PRESET_COLORS.map(hex => (
              <button
                key={hex}
                type="button"
                class={style.colorSwatch}
                style={{ backgroundColor: hex }}
                onClick={() => this.selectPresetColor(hex)}
                title={hex}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export default ColorPickerPopover;
