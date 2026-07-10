import { Component } from 'preact';
import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import { Link } from 'preact-router';
import get from 'get-value';
import { DEVICE_POLL_FREQUENCIES, DEVICE_ROTATION } from '../../../../../../server/utils/constants';
import DeviceFeatures from '../../../../components/device/view/DeviceFeatures';
import { connect } from 'unistore/preact';

const CAMERA_URL_PARAM = 'CAMERA_URL';
const CAMERA_ROTATION_PARAM = 'CAMERA_ROTATION';

class FreeboxDeviceBox extends Component {
  componentWillMount() {
    this.setState({
      device: this.props.device
    });
  }

  componentWillReceiveProps(nextProps) {
    // Only reset the local copy when the device really changed (e.g. after a refresh),
    // otherwise a parent re-render would erase edits in progress
    if (nextProps.device !== this.props.device) {
      this.setState({
        device: nextProps.device
      });
    }
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

  updatePollFrequency = e => {
    this.setState({
      device: {
        ...this.state.device,
        poll_frequency: parseInt(e.target.value, 10)
      }
    });
  };

  updateParam = (name, value) => {
    const params = this.state.device.params ? [...this.state.device.params] : [];
    const paramIndex = params.findIndex(param => param.name === name);
    if (paramIndex === -1) {
      params.push({ name, value });
    } else {
      params[paramIndex] = { ...params[paramIndex], value };
    }
    this.setState({
      device: {
        ...this.state.device,
        params
      }
    });
  };

  updateCameraUrl = e => {
    this.updateParam(CAMERA_URL_PARAM, e.target.value);
  };

  updateCameraRotation = e => {
    this.updateParam(CAMERA_ROTATION_PARAM, e.target.value);
  };

  testConnection = async () => {
    this.setState({
      loading: true,
      testConnectionError: null,
      testConnectionErrorMessage: null
    });
    try {
      const cameraImage = await this.props.httpClient.post(
        '/api/v1/service/rtsp-camera/camera/test',
        this.state.device
      );
      this.setState({
        cameraImage
      });
    } catch (e) {
      this.setState({
        cameraImage: null,
        testConnectionError: true,
        testConnectionErrorMessage: get(e, 'response.data.error')
      });
    }
    this.setState({
      loading: false
    });
  };

  saveDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null
    });
    try {
      const savedDevice = await this.props.httpClient.post(`/api/v1/device`, this.state.device);
      this.setState({
        device: savedDevice
      });
    } catch (e) {
      let errorMessage = 'integration.freebox.error.defaultError';
      if (e.response.status === 409) {
        errorMessage = 'integration.freebox.error.conflictError';
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
      this.props.getFreeboxDevices();
    } catch (e) {
      const status = get(e, 'response.status');
      const dataMessage = get(e, 'response.data.message');
      if (status === 400 && dataMessage && dataMessage.includes('Too much states')) {
        const statesNumber = new Intl.NumberFormat().format(dataMessage.split(' ')[0]);
        this.setState({ tooMuchStatesError: true, statesNumber });
      } else {
        this.setState({
          errorMessage: 'integration.freebox.error.defaultDeletionError'
        });
      }
    }
    this.setState({
      loading: false
    });
  };

  render(
    { deviceIndex, device, housesWithRooms, editable, ...props },
    {
      device: stateDevice,
      loading,
      errorMessage,
      tooMuchStatesError,
      statesNumber,
      cameraImage,
      testConnectionError,
      testConnectionErrorMessage
    }
  ) {
    const validModel = device.features && device.features.length > 0;
    const cameraUrlParam =
      stateDevice && stateDevice.params && stateDevice.params.find(param => param.name === CAMERA_URL_PARAM);
    const cameraRotationParam =
      stateDevice && stateDevice.params && stateDevice.params.find(param => param.name === CAMERA_ROTATION_PARAM);
    // Camera settings are only shown on the device page (showCameraSettings),
    // not in the discover view where devices are simply added
    const isCamera = Boolean(cameraUrlParam) && Boolean(props.showCameraSettings);

    return (
      <div class="col-md-6">
        <div class="card">
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              {isCamera && cameraImage && (
                <img class="card-img-top" src={`data:${cameraImage}`} alt={stateDevice.name} />
              )}
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
                {testConnectionError && (
                  <div class="alert alert-danger">
                    <Text id="integration.freebox.camera.testConnectionError" />
                  </div>
                )}
                {testConnectionErrorMessage && <div class="alert alert-danger">{testConnectionErrorMessage}</div>}
                <div class="form-group">
                  <label class="form-label" for={`name_${deviceIndex}`}>
                    <Text id={isCamera ? 'integration.freebox.camera.nameLabel' : 'integration.freebox.nameLabel'} />
                  </label>
                  <Localizer>
                    <input
                      id={`name_${deviceIndex}`}
                      type="text"
                      value={stateDevice.name}
                      onInput={this.updateName}
                      class="form-control"
                      placeholder={
                        <Text
                          id={
                            isCamera
                              ? 'integration.freebox.camera.namePlaceholder'
                              : 'integration.freebox.namePlaceholder'
                          }
                        />
                      }
                      disabled={!validModel}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label class="form-label" for={`room_${deviceIndex}`}>
                    <Text id="integration.freebox.roomLabel" />
                  </label>
                  <select
                    id={`room_${deviceIndex}`}
                    onChange={this.updateRoom}
                    class="form-control"
                    disabled={!validModel}
                  >
                    <option value="">
                      <Text id="global.emptySelectOption" />
                    </option>
                    {housesWithRooms &&
                      housesWithRooms.map(house => (
                        <optgroup label={house.name}>
                          {house.rooms.map(room => (
                            <option selected={room.id === stateDevice.room_id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>

                {isCamera && (
                  <div class="form-group">
                    <label class="form-label" for={`pollFrequency_${deviceIndex}`}>
                      <Text id="integration.freebox.camera.pollFrequencyLabel" />
                    </label>
                    <select
                      id={`pollFrequency_${deviceIndex}`}
                      onChange={this.updatePollFrequency}
                      value={stateDevice.poll_frequency}
                      class="form-control"
                    >
                      <option value={DEVICE_POLL_FREQUENCIES.EVERY_MINUTES}>
                        <Text id="integration.freebox.camera.everyMinutes" />
                      </option>
                      <option value={DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS}>
                        <Text id="integration.freebox.camera.every30Seconds" />
                      </option>
                      <option value={DEVICE_POLL_FREQUENCIES.EVERY_10_SECONDS}>
                        <Text id="integration.freebox.camera.every10Seconds" />
                      </option>
                      <option value={DEVICE_POLL_FREQUENCIES.EVERY_2_SECONDS}>
                        <Text id="integration.freebox.camera.every2Seconds" />
                      </option>
                      <option value={DEVICE_POLL_FREQUENCIES.EVERY_SECONDS}>
                        <Text id="integration.freebox.camera.every1Seconds" />
                      </option>
                    </select>
                  </div>
                )}

                {isCamera && (
                  <div class="form-group">
                    <label class="form-label" for={`cameraUrl_${deviceIndex}`}>
                      <Text id="integration.freebox.camera.urlLabel" />
                    </label>
                    <Localizer>
                      <input
                        id={`cameraUrl_${deviceIndex}`}
                        type="text"
                        value={cameraUrlParam.value}
                        onInput={this.updateCameraUrl}
                        class="form-control"
                        placeholder={<Text id="integration.freebox.camera.urlPlaceholder" />}
                      />
                    </Localizer>
                    <p class="mt-2">
                      <small>
                        <MarkupText id="integration.freebox.camera.urlExplanation" />
                      </small>
                    </p>
                  </div>
                )}

                {isCamera && (
                  <div class="form-group">
                    <select
                      id={`cameraRotation_${deviceIndex}`}
                      onChange={this.updateCameraRotation}
                      value={(cameraRotationParam && cameraRotationParam.value) || DEVICE_ROTATION.DEGREES_0}
                      class="form-control"
                    >
                      <option value={DEVICE_ROTATION.DEGREES_0}>
                        <Text id="integration.freebox.camera.rotation0" />
                      </option>
                      <option value={DEVICE_ROTATION.DEGREES_90}>
                        <Text id="integration.freebox.camera.rotation90" />
                      </option>
                      <option value={DEVICE_ROTATION.DEGREES_180}>
                        <Text id="integration.freebox.camera.rotation180" />
                      </option>
                      <option value={DEVICE_ROTATION.DEGREES_270}>
                        <Text id="integration.freebox.camera.rotation270" />
                      </option>
                    </select>
                  </div>
                )}

                {!isCamera && validModel && (
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.freebox.device.featuresLabel" />
                    </label>
                    <DeviceFeatures features={device.features} />
                  </div>
                )}

                <div class="form-group">
                  {isCamera && validModel && (
                    <button onClick={this.testConnection} class="btn btn-info mr-2">
                      <Text id="integration.freebox.camera.testConnectionButton" />
                    </button>
                  )}

                  {validModel && props.alreadyCreatedButton && (
                    <button class="btn btn-primary mr-2" disabled="true">
                      <Text id="integration.freebox.alreadyCreatedButton" />
                    </button>
                  )}

                  {validModel && props.updateButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.freebox.updateButton" />
                    </button>
                  )}

                  {validModel && props.saveButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.freebox.saveButton" />
                    </button>
                  )}

                  {validModel && props.deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger">
                      <Text id="integration.freebox.deleteButton" />
                    </button>
                  )}

                  {!validModel && (
                    <button class="btn btn-dark" disabled>
                      <Text id="integration.freebox.unmanagedModelButton" />
                    </button>
                  )}

                  {!isCamera && validModel && props.editButton && (
                    <Link href={`/dashboard/integration/device/freebox/edit/${device.selector}`}>
                      <button class="btn btn-secondary float-right">
                        <Text id="integration.freebox.device.editButton" />
                      </button>
                    </Link>
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

export default connect('httpClient', {})(FreeboxDeviceBox);
