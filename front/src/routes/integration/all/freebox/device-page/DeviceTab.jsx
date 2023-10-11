import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';

import EmptyState from './EmptyState';
import { RequestStatus } from '../../../../../utils/consts';
import style from './style.css';
import CardFilter from '../../../../../components/layout/CardFilter';
import FreeboxDeviceBox from '../FreeboxDeviceBox';
import debounce from 'debounce';
import { Component } from 'preact';
import { connect } from 'unistore/preact';

class DeviceTab extends Component {
  constructor(props) {
    super(props);
    this.debouncedSearch = debounce(this.search, 200).bind(this);
  }

  componentWillMount() {
    this.getFreeboxDevices();
    this.getHouses();
  }

  async getFreeboxDevices() {
    this.setState({
      getFreeboxStatus: RequestStatus.Getting
    });
    try {
      const options = {
        order_dir: this.state.orderDir || 'asc'
      };
      if (this.state.search && this.state.search.length) {
        options.search = this.state.search;
      }

      const freeboxDevices = await this.props.httpClient.get('/api/v1/service/freebox/device', options);
      this.setState({
        freeboxDevices,
        getFreeboxStatus: RequestStatus.Success
      });
    } catch (e) {
      this.setState({
        getFreeboxStatus: e.message
      });
    }
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

  async search(e) {
    await this.setState({
      search: e.target.value
    });
    this.getFreeboxDevices();
  }
  async changeOrderDir(e) {
    await this.setState({
      orderDir: e.target.value
    });
    this.getFreeboxDevices();
  }

  render({}, { orderDir, search, getFreeboxStatus, freeboxDevices, housesWithRooms }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.freebox.device.title" />
          </h1>
          <div class="page-options d-flex">
            <Localizer>
              <CardFilter
                changeOrderDir={this.changeOrderDir.bind(this)}
                orderValue={orderDir}
                search={this.debouncedSearch}
                searchValue={search}
                searchPlaceHolder={<Text id="device.searchPlaceHolder" />}
              />
            </Localizer>
          </div>
        </div>
        <div class="card-body">
          <div
            class={cx('dimmer', {
              active: getFreeboxStatus === RequestStatus.Getting
            })}
          >
            <div class="loader" />
            <div class={cx('dimmer-content', style.freeboxListBody)}>
              <div class="row">
                {freeboxDevices &&
                  freeboxDevices.length > 0 &&
                  freeboxDevices.map((device, index) => (
                    <FreeboxDeviceBox
                      editable
                      editButton
                      saveButton
                      deleteButton
                      device={device}
                      deviceIndex={index}
                      getFreeboxDevices={this.getFreeboxDevices.bind(this)}
                      housesWithRooms={housesWithRooms}
                    />
                  ))}
                {!freeboxDevices || (freeboxDevices.length === 0 && <EmptyState />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  }

}

export default connect('httpClient', {})(DeviceTab);
