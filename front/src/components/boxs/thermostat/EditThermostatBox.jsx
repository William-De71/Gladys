import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import Select from 'react-select';
import { getDeviceFeatureName } from '../../../utils/device';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import BaseEditBox from '../baseEditBox';
import { DEVICE_FEATURE_CATEGORIES } from '../../../../../server/utils/constants';

const THERMOSTAT_CATEGORIES = [
  DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
  DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING
];

class EditThermostatBoxComponent extends Component {
  updateName = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, { name: e.target.value || undefined });
  };

  updateThermostatFeature = option => {
    const feature = option ? option.value : null;
    this.props.updateBoxConfig(this.props.x, this.props.y, { thermostat_feature: feature });
    this.setState({ selectedThermostatOption: option });
  };

  buildOptions = devices => {
    const options = [];
    devices.forEach(device => {
      const featureOptions = [];
      device.features.forEach(feature => {
        if (!THERMOSTAT_CATEGORIES.includes(feature.category)) return;
        featureOptions.push({
          value: feature.selector,
          label: getDeviceFeatureName(this.props.intl.dictionary, device, feature)
        });
      });
      if (featureOptions.length > 0) {
        options.push({ label: device.name, options: featureOptions });
      }
    });
    return options;
  };

  getDevices = async () => {
    try {
      const devices = await this.props.httpClient.get('/api/v1/device');
      const thermostatOptions = this.buildOptions(devices);
      let selectedThermostatOption = null;
      thermostatOptions.forEach(group =>
        group.options.forEach(opt => {
          if (opt.value === this.props.box.thermostat_feature) selectedThermostatOption = opt;
        })
      );
      this.setState({ thermostatOptions, selectedThermostatOption });
    } catch (e) {
      this.setState({ thermostatOptions: [] });
    }
  };

  componentDidMount() {
    this.getDevices();
  }

  render(props, { thermostatOptions, selectedThermostatOption }) {
    const placeholder = props.intl && props.intl.dictionary
      ? props.intl.dictionary.dashboard.boxes.thermostat.selectPlaceholder
      : '';

    return (
      <BaseEditBox {...props} titleKey="dashboard.boxTitle.thermostat">
        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.editNameLabel" />
          </label>
          <input
            type="text"
            class="form-control"
            placeholder={props.intl && props.intl.dictionary
              ? props.intl.dictionary.dashboard.boxes.thermostat.editNamePlaceholder
              : ''}
            value={props.box.name || ''}
            onInput={this.updateName}
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.thermostatFeatureLabel" />
            <span class="text-danger"> *</span>
          </label>
          <Select
            value={selectedThermostatOption}
            onChange={this.updateThermostatFeature}
            options={thermostatOptions}
            placeholder={placeholder}
            maxMenuHeight={220}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              valueContainer: provided => ({ ...provided, paddingLeft: '8px' }),
              input: provided => ({ ...provided, paddingLeft: '4px' }),
              placeholder: provided => ({ ...provided, paddingLeft: '4px' }),
              singleValue: provided => ({ ...provided, marginLeft: '0px', paddingLeft: '4px' })
            }}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.thermostatFeatureHelp" />
          </small>
        </div>
      </BaseEditBox>
    );
  }
}

export default connect('httpClient', {})(withIntlAsProp(EditThermostatBoxComponent));
