import { Component, createRef, Fragment } from 'preact';
import iro from '@jaames/iro';

import { intToHex, hexToInt } from '../../../../../../server/utils/colors';

import style from './style.css';

const PRESET_COLORS = [
  '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00',
  '#7FFF00', '#00FF00', '#00FA9A', '#00FFFF', '#00BFFF',
  '#0000FF', '#8A2BE2', '#FF00FF', '#FF69B4', '#FFFFFF',
  '#FFF5E1', '#FAEBD7', '#E0F0FF', '#F5F5F5', '#D3D3D3'
];

let popoverIdCounter = 0;

class ColorDeviceType extends Component {
  popoverId = `gladys-color-picker-${++popoverIdCounter}`;
  swatchOverlayId = `gladys-color-swatch-${popoverIdCounter}`;
  colorPickerRef = createRef();
  popoverRef = createRef();
  buttonRef = createRef();
  swatchOverlayRef = createRef();

  componentDidMount() {
    const deviceLastValue = this.props.deviceFeature.last_value;
    const color = !deviceLastValue ? undefined : `#${intToHex(deviceLastValue)}`;

    this.colorPicker = new iro.ColorPicker(this.colorPickerRef.current, {
      width: 150,
      color,
      layout: [
        {
          component: iro.ui.Wheel,
          options: {}
        }
      ]
    });
    this.colorPicker.on('input:end', c => this.updateValue(c));

    if (this.popoverRef.current) {
      this.popoverRef.current.addEventListener('toggle', this.handleToggle);
    }
    this.showSwatchOverlay();
    window.addEventListener('resize', this.repositionAll);
    window.addEventListener('scroll', this.repositionAll, true);
  }

  componentWillUnmount() {
    if (this.popoverRef.current) {
      this.popoverRef.current.removeEventListener('toggle', this.handleToggle);
    }
    window.removeEventListener('resize', this.repositionAll);
    window.removeEventListener('scroll', this.repositionAll, true);
    if (this.swatchOverlayRef.current) {
      try {
        this.swatchOverlayRef.current.hidePopover();
      } catch (e) {
        // ignore
      }
    }
  }

  componentDidUpdate() {
    this.positionSwatchOverlay();
  }

  showSwatchOverlay = () => {
    const ov = this.swatchOverlayRef.current;
    if (!ov || typeof ov.showPopover !== 'function') return;
    try {
      ov.showPopover();
    } catch (e) {
      // already shown
    }
    this.positionSwatchOverlay();
  };

  positionSwatchOverlay = () => {
    const ov = this.swatchOverlayRef.current;
    const btn = this.buttonRef.current;
    if (!ov || !btn) return;
    if (typeof ov.matches === 'function' && !ov.matches(':popover-open')) return;
    const rect = btn.getBoundingClientRect();
    ov.style.top = `${rect.top + 2}px`;
    ov.style.left = `${rect.left + 2}px`;
    ov.style.width = `${rect.width - 4}px`;
    ov.style.height = `${rect.height - 4}px`;
  };

  repositionAll = () => {
    this.positionPopover();
    this.positionSwatchOverlay();
  };

  handleToggle = event => {
    if (event.newState === 'open') {
      this.positionPopover();
    }
  };

  positionPopover = () => {
    const pop = this.popoverRef.current;
    const btn = this.buttonRef.current;
    if (!pop || !btn) return;
    if (typeof pop.matches === 'function' && !pop.matches(':popover-open')) return;
    const row = btn.closest('tr');
    const rect = (row || btn).getBoundingClientRect();
    pop.style.top = `${rect.bottom + 4}px`;
    pop.style.left = `${rect.left}px`;
    pop.style.width = `${rect.width}px`;
  };

  updateValue = color => {
    const colorInt = hexToInt(color.hexString);
    this.props.updateValue(this.props.deviceFeature, colorInt);
  };

  selectPresetColor = hex => {
    if (this.colorPicker) {
      this.colorPicker.color.hexString = hex;
    }
    this.props.updateValue(this.props.deviceFeature, hexToInt(hex.replace('#', '')));
  };

  closePopover = () => {
    const pop = this.popoverRef.current;
    if (pop && typeof pop.hidePopover === 'function') {
      try {
        pop.hidePopover();
      } catch (e) {
        // ignore: popover not open
      }
    }
  };

  render({ rowName, deviceFeature }) {
    const deviceLastValue = deviceFeature.last_value;
    const color = !deviceLastValue ? undefined : `#${intToHex(deviceLastValue)}`;

    return (
      <Fragment>
        <tr>
          <td>
            <i class="fe fe-circle" />
          </td>
          <td>{rowName}</td>
          <td class="text-right">
            <div class="m-0 float-right d-flex">
              <button
                ref={this.buttonRef}
                popovertarget={this.popoverId}
                class="btn py-2 border-1 border-dark"
                style={{ backgroundColor: color }}
                type="button"
              />
              <div
                ref={this.swatchOverlayRef}
                id={this.swatchOverlayId}
                popover="manual"
                class={style.colorSwatchOverlay}
                style={{ backgroundColor: color }}
              />
            </div>
          </td>
        </tr>
        <tr>
          <td colSpan="3" class="border-0 p-0">
            <div
              ref={this.popoverRef}
              id={this.popoverId}
              popover="auto"
              class={style.colorPickerPopover}
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
          </td>
        </tr>
      </Fragment>
    );
  }
}

export default ColorDeviceType;
