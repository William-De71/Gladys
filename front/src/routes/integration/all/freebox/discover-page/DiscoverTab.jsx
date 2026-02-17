import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';
import { connect } from 'unistore/preact';
import cx from 'classnames';

import EmptyState from './EmptyState';
import style from './style.css';
import FreeboxDeviceBox from '../FreeboxDeviceBox';

import { RequestStatus } from '../../../../../utils/consts';

class DiscoverTab extends Component {
  constructor(props) {
    super(props);
    this.state = {
      filterExisting: true
    };
  }

  async componentWillMount() {
    this.getDiscoveredDevices();
    this.getHouses();
  }

  async getHouses() {
    this.setState({
      housesGetStatus: RequestStatus.Getting
    });
    try {
      const params = {
        expand: 'rooms'
      };
      const housesWithRooms = await this.props.httpClient.get(`/api/v1/house`, params);
      this.setState({
        housesWithRooms,
        housesGetStatus: RequestStatus.Success
      });
    } catch (e) {
      this.setState({
        housesGetStatus: RequestStatus.Error
      });
    }
  }

  async getDiscoveredDevices() {
    this.setState({
      loading: true,
      errorLoading: false,
      discoverError: null
    });
    try {
      const discoveredDevices = await this.props.httpClient.get('/api/v1/service/freebox/discover', {
        filter_existing: this.state.filterExisting
      });
      this.setState({
        discoveredDevices,
        loading: false,
        errorLoading: false
      });
    } catch (e) {
      console.error('Freebox discover error:', e);
      this.setState({
        loading: false,
        errorLoading: true,
        discoverError: e.response && e.response.data ? e.response.data.message : e.message
      });
    }
  }

  toggleFilterExisting = async () => {
    await new Promise((resolve) => {
      this.setState((prevState) => ({ filterExisting: !prevState.filterExisting }), resolve);
    });
    this.getDiscoveredDevices();
  };

  render(props, { loading, errorLoading, discoverError, discoveredDevices, housesWithRooms, filterExisting }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.freebox.discover.title" />
          </h1>
          <div class="page-options d-flex">
            <button
              onClick={this.getDiscoveredDevices.bind(this)}
              class="btn btn-outline-primary ml-2"
              disabled={loading}
            >
              <Text id="integration.freebox.discover.scan" /> <i class="fe fe-radio" />
            </button>
          </div>
        </div>
        <ul class="list-group list-group-flush">
          <li class="list-group-item">
            <label class="custom-switch">
              <input
                type="checkbox"
                class="custom-switch-input"
                checked={filterExisting}
                onClick={this.toggleFilterExisting}
                disabled={loading}
              />
              <span class={cx('custom-switch-indicator', 'mr-1', { 'bg-light': loading })} />
              <span class="custom-switch-description">
                <Text id="integration.freebox.discover.hideExistingDevices" />
              </span>
            </label>
          </li>
        </ul>
        <div class="card-body">
          <div class="alert alert-secondary">
            <Text id="integration.freebox.discover.description" />
          </div>
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class={cx('dimmer-content', style.freeboxListBody)}>
              {errorLoading && (
                <div class="alert alert-warning">
                  <Text id="integration.freebox.status.notConnected" />
                  <Link href="/dashboard/integration/device/freebox/setup">
                    <Text id="integration.freebox.status.setupPageLink" />
                  </Link>
                  {discoverError && (
                    <div class="mt-2"><small>{discoverError}</small></div>
                  )}
                </div>
              )}
              <div class="row">
                {discoveredDevices &&
                  discoveredDevices.map((device, index) => (
                    <FreeboxDeviceBox
                      editable={!device.created_at || device.updatable}
                      alreadyCreatedButton={device.created_at && !device.updatable}
                      updateButton={device.updatable}
                      saveButton={!device.created_at}
                      device={device}
                      deviceIndex={index}
                      housesWithRooms={housesWithRooms}
                    />
                  ))}
                {(!discoveredDevices || discoveredDevices.length === 0) && <EmptyState />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(DiscoverTab);
