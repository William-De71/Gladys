import { Text } from 'preact-i18n';
import { useState, useEffect } from 'preact/hooks';
import get from 'get-value';
import cx from 'classnames';

import { DeviceFeatureCategoriesIcon } from '../../../../utils/consts';

import style from './style.css';

const MultiLevelWithInputDeviceFeature = ({ children, ...props }) => {
  const { deviceFeature } = props;
  const [localValue, setLocalValue] = useState(deviceFeature.last_value);

  useEffect(() => {
    setLocalValue(deviceFeature.last_value);
  }, [deviceFeature.last_value]);

  const clamp = value => {
    let v = Number(value);
    if (Number.isNaN(v)) {
      return deviceFeature.min;
    }
    if (deviceFeature.min !== undefined && v < deviceFeature.min) v = deviceFeature.min;
    if (deviceFeature.max !== undefined && v > deviceFeature.max) v = deviceFeature.max;
    return v;
  };

  const handleSlider = e => {
    const v = e.target.value;
    setLocalValue(v);
    props.updateValueWithDebounce(deviceFeature, v);
  };

  const handleInput = e => {
    setLocalValue(e.target.value);
  };

  const commitInput = () => {
    const v = clamp(localValue);
    setLocalValue(v);
    props.updateValueWithDebounce(deviceFeature, v);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <tr>
      <td>
        <i
          class={`fe fe-${get(DeviceFeatureCategoriesIcon, `${deviceFeature.category}.${deviceFeature.type}`, {
            default: 'arrow-right'
          })}`}
        />
      </td>
      <td>{props.rowName}</td>

      <td class={cx('text-right py-0', style.fullWidthCell)}>
        <div class={style.stackedControl}>
          <div class={style.numericRow}>
            <input
              type="number"
              value={localValue}
              onInput={handleInput}
              onBlur={commitInput}
              onKeyDown={handleKeyDown}
              class={cx('form-control form-control-sm text-center px-1', style.numericInput)}
              step={1}
              min={deviceFeature.min}
              max={deviceFeature.max}
            />
            {deviceFeature.unit && (
              <span class="ml-1">
                <Text id={`deviceFeatureUnitShort.${deviceFeature.unit}`} />
              </span>
            )}
          </div>
          <input
            type="range"
            value={localValue}
            onInput={handleSlider}
            class={cx('custom-range', style.rangeInput)}
            step="1"
            min={deviceFeature.min}
            max={deviceFeature.max}
          />
        </div>
      </td>
    </tr>
  );
};

export default MultiLevelWithInputDeviceFeature;
