import { Component } from 'preact';
import { Text } from 'preact-i18n';
import Select from 'react-select';
import get from 'get-value';

import { SIREN_MODE } from '../../../../server/utils/constants';
import withIntlAsProp from '../../utils/withIntlAsProp';

class SelectSirenMode extends Component {
  handleValueChange = ({ value }) => {
    this.props.updateValue(value);
  };

  getOptions = () => {
    const deviceFeatureOptions = Object.keys(SIREN_MODE).map(key => {
      const value = SIREN_MODE[key];
      return {
        label: get(this.props.intl.dictionary, `deviceFeatureAction.category.siren.mode.${key.toLowerCase()}`, {
          default: key.toLowerCase()
        }),
        value
      };
    });

    this.setState({ deviceFeatureOptions });
  };

  getSelectedOption = () => {
    const value = this.props.value;

    if (value !== undefined && value !== null && value !== '') {
      const numValue = Number(value);
      const entry = Object.entries(SIREN_MODE).find(([, v]) => v === numValue);
      const key = entry ? entry[0].toLowerCase() : String(value);
      return {
        label: get(this.props.intl.dictionary, `deviceFeatureAction.category.siren.mode.${key}`, {
          default: key
        }),
        value: numValue
      };
    }
    return undefined;
  };

  componentDidMount() {
    this.getOptions();
  }

  render(props, { deviceFeatureOptions }) {
    const selectedOption = this.getSelectedOption();
    return (
      <Select
        class="select-device-feature"
        defaultValue={''}
        value={selectedOption}
        onChange={this.handleValueChange}
        options={deviceFeatureOptions}
        placeholder={<Text id="global.selectPlaceholder" />}
        className="react-select-container"
        classNamePrefix="react-select"
      />
    );
  }
}

export default withIntlAsProp(SelectSirenMode);
