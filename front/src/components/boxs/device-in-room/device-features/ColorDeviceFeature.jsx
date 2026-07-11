import { Component } from 'preact';

import ColorPickerPopover from '../../../device/ColorPickerPopover';

class ColorDeviceType extends Component {
  updateValue = colorInt => {
    this.props.updateValue(this.props.deviceFeature, colorInt);
  };

  render({ rowName, deviceFeature }) {
    return (
      <tr>
        <td>
          <i class="fe fe-circle" />
        </td>
        <td>{rowName}</td>
        <td class="text-right">
          <div class="m-0 float-right d-flex">
            <ColorPickerPopover value={deviceFeature.last_value} updateValue={this.updateValue} />
          </div>
        </td>
      </tr>
    );
  }
}

export default ColorDeviceType;
