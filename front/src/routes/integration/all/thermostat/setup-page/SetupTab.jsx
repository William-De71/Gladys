import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { RequestStatus } from '../../../../../utils/consts';

class SetupTab extends Component {
  componentWillMount() {
    this.getConfiguration();
  }

  async getConfiguration() {
    this.setState({ getSettingsStatus: RequestStatus.Getting });
    try {
      const [minTemp, maxTemp, tempUnit] = await Promise.all([
        this.props.httpClient.get('/api/v1/variable/THERMOSTAT_MIN_TEMP').catch(() => ({ value: '5' })),
        this.props.httpClient.get('/api/v1/variable/THERMOSTAT_MAX_TEMP').catch(() => ({ value: '35' })),
        this.props.httpClient.get('/api/v1/variable/THERMOSTAT_TEMP_UNIT').catch(() => ({ value: 'C' }))
      ]);
      this.setState({
        getSettingsStatus: RequestStatus.Success,
        thermostatMinTemp: minTemp.value,
        thermostatMaxTemp: maxTemp.value,
        thermostatTempUnit: tempUnit.value
      });
    } catch (e) {
      this.setState({ getSettingsStatus: RequestStatus.Error });
    }
  }

  saveConfiguration = async e => {
    e.preventDefault();
    this.setState({ saveSettingsStatus: RequestStatus.Getting });
    try {
      await Promise.all([
        this.props.httpClient.post('/api/v1/variable/THERMOSTAT_MIN_TEMP', {
          value: String(this.state.thermostatMinTemp)
        }),
        this.props.httpClient.post('/api/v1/variable/THERMOSTAT_MAX_TEMP', {
          value: String(this.state.thermostatMaxTemp)
        }),
        this.props.httpClient.post('/api/v1/variable/THERMOSTAT_TEMP_UNIT', {
          value: this.state.thermostatTempUnit
        })
      ]);
      this.setState({ saveSettingsStatus: RequestStatus.Success });
    } catch (e) {
      this.setState({ saveSettingsStatus: RequestStatus.Error });
    }
  };

  updateField = e => {
    this.setState({ [e.target.name]: e.target.value });
  };

  render(props, state) {
    const saving = state.saveSettingsStatus === RequestStatus.Getting;
    const loading = state.getSettingsStatus === RequestStatus.Getting;

    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.thermostat.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <div class={cx('dimmer', { active: loading || saving })}>
            <div class="loader" />
            <div class="dimmer-content">
              <p>
                <Text id="integration.thermostat.setup.description" />
              </p>

              <form onSubmit={this.saveConfiguration}>
                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.setup.tempUnitLabel" />
                  </label>
                  <select
                    name="thermostatTempUnit"
                    class="form-control"
                    value={state.thermostatTempUnit}
                    onChange={this.updateField}
                  >
                    <option value="C">
                      <Text id="integration.thermostat.setup.celsius" />
                    </option>
                    <option value="F">
                      <Text id="integration.thermostat.setup.fahrenheit" />
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.setup.minTempLabel" />
                  </label>
                  <Localizer>
                    <input
                      name="thermostatMinTemp"
                      type="number"
                      class="form-control"
                      placeholder={<Text id="integration.thermostat.setup.minTempPlaceholder" />}
                      value={state.thermostatMinTemp}
                      onInput={this.updateField}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.setup.maxTempLabel" />
                  </label>
                  <Localizer>
                    <input
                      name="thermostatMaxTemp"
                      type="number"
                      class="form-control"
                      placeholder={<Text id="integration.thermostat.setup.maxTempPlaceholder" />}
                      value={state.thermostatMaxTemp}
                      onInput={this.updateField}
                    />
                  </Localizer>
                </div>

                <div class="row mt-5">
                  <div class="col">
                    <button type="submit" class={cx('btn', 'btn-success', { 'btn-loading': saving })}>
                      <Text id="integration.thermostat.setup.saveLabel" />
                    </button>
                  </div>
                </div>

                {state.saveSettingsStatus === RequestStatus.Success && (
                  <div class="alert alert-success mt-3">
                    <Text id="integration.thermostat.setup.saveSuccess" />
                  </div>
                )}
                {state.saveSettingsStatus === RequestStatus.Error && (
                  <div class="alert alert-danger mt-3">
                    <Text id="integration.thermostat.setup.saveError" />
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(SetupTab);
