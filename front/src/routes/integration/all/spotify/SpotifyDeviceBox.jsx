import { Component } from 'preact';
import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import get from 'get-value';

import { connect } from 'unistore/preact';

class SpotifyDeviceBox extends Component {
  componentWillMount() {
    this.setState({
      device: this.props.device
    });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      device: nextProps.device
    });
  }

  updateName = e => {
    this.setState({
      device: {
        ...this.state.device,
        name: e.target.value
      }
    });
  };

  updateRoom = e => {
    this.setState({
      device: {
        ...this.state.device,
        room_id: e.target.value
      }
    });
  };

  saveDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null
    });
    try {
      let deviceDidNotExist = this.state.device.id === undefined;
      const savedDevice = await this.props.httpClient.post(`/api/v1/device`, this.state.device);
      if (deviceDidNotExist) {
        savedDevice.alreadyExist = true;
      }
      this.setState({
        device: savedDevice
      });
    } catch (e) {
      let errorMessage = 'integration.spotify.error.defaultError';
      if (e.response.status === 409) {
        errorMessage = 'integration.spotify.error.conflictError';
      }
      this.setState({
        errorMessage
      });
    }
    this.setState({
      loading: false
    });
  };

  deleteDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null,
      tooMuchStatesError: false,
      statesNumber: undefined
    });
    try {
      if (this.state.device.created_at) {
        await this.props.httpClient.delete(`/api/v1/device/${this.state.device.selector}`);
      }
      this.props.getSpotifyDevices();
    } catch (e) {
      const status = get(e, 'response.status');
      const dataMessage = get(e, 'response.data.message');
      if (status === 400 && dataMessage && dataMessage.includes('Too much states')) {
        const statesNumber = new Intl.NumberFormat().format(dataMessage.split(' ')[0]);
        this.setState({ tooMuchStatesError: true, statesNumber });
      } else {
        this.setState({
          errorMessage: 'integration.spotify.error.defaultDeletionError'
        });
      }
    }
    this.setState({
      loading: false
    });
  };

  render(
    { deviceIndex, editable, deleteButton, housesWithRooms },
    { device, loading, errorMessage, tooMuchStatesError, statesNumber }
  ) {
    const validModel = device.features && device.features.length > 0;

    return (
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">{device.name}</div>
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <div class="card-body">
                {errorMessage && (
                  <div class="alert alert-danger">
                    <Text id={errorMessage} />
                  </div>
                )}
                {tooMuchStatesError && (
                  <div class="alert alert-warning">
                    <MarkupText id="device.tooMuchStatesToDelete" fields={{ count: statesNumber }} />
                  </div>
                )}
                <div class="form-group">
                  <label class="form-label" for={`name_${deviceIndex}`}>
                    <Text id="integration.spotify.nameLabel" />
                  </label>
                  <Localizer>
                    <input
                      id={`name_${deviceIndex}`}
                      type="text"
                      value={device.name}
                      onInput={this.updateName}
                      class="form-control"
                      placeholder={<Text id="integration.spotify.namePlaceholder" />}
                      disabled={!editable || !validModel}
                    />
                  </Localizer>
                </div>

                {device.model && (
                  <div class="form-group">
                    <label class="form-label" for={`model_${deviceIndex}`}>
                      <Text id="integration.spotify.modelLabel" />
                    </label>
                    <input id={`model_${deviceIndex}`} type="text" value={device.model} class="form-control" disabled />
                  </div>
                )}

                {housesWithRooms && (
                  <div class="form-group">
                    <label class="form-label" for={`room_${deviceIndex}`}>
                      <Text id="integration.spotify.roomLabel" />
                    </label>
                    <select
                      id={`room_${deviceIndex}`}
                      onChange={this.updateRoom}
                      class="form-control"
                      disabled={!editable || !validModel}
                    >
                      <option value="">
                        <Text id="global.emptySelectOption" />
                      </option>
                      {housesWithRooms &&
                        housesWithRooms.map(house => (
                          <optgroup label={house.name}>
                            {house.rooms.map(room => (
                              <option selected={room.id === device.room_id} value={room.id}>
                                {room.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                    </select>
                  </div>
                )}

                <div class="form-group">
                  {device.alreadyExist && (
                    <button class="btn btn-primary mr-2" disabled="true">
                      <Text id="integration.spotify.alreadyCreatedButton" />
                    </button>
                  )}

                  {!device.alreadyExist && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.spotify.saveButton" />
                    </button>
                  )}

                  {deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger">
                      <Text id="integration.spotify.deleteButton" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(SpotifyDeviceBox);
