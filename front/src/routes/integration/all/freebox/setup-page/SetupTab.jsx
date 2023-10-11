import { Component } from 'preact';
import { Text, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';

class SetupTab extends Component {
  
  render(props) {
    let statusMessage = null;

    if ((props.authorizedFreeboxStatus === RequestStatus.Error) || (props.discoverFreeboxStatus === RequestStatus.Error)) {
      // Error 
      statusMessage = (
        <p class="alert alert-danger">
          <Text id="integration.freebox.setup.error" />
        </p>
      );
    }
    else if (props.discoverFreeboxStatus === RequestStatus.NetworkError) {
      // Error freebox not found on local network
      statusMessage = (
        <p class="alert alert-info">
          <Text id="integration.freebox.setup.noFreeboxFound" />
        </p>
      );
    }
    else if ((props.authorizedFreeboxStatus === RequestStatus.Success) && (props.appToken.length > 0)) {
      // Freebox Connected
      statusMessage = (
        <p class="alert alert-success">
          <Text id="integration.freebox.setup.connected" />
        </p>
      );
    }

    return (
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">       
            <Text id="integration.freebox.setup.title" />
          </h3>
          <div class="page-options d-flex">
            <button
              class="btn btn-info"
              onClick={props.discoverFreebox}
              disabled={props.discoverFreeboxStatus === RequestStatus.Getting}
            >
              <i class="fe fe-radio" /> <Text id="integration.freebox.setup.scanButton" />
            </button>
          </div>
        </div>
        <div class="card-body">
          <div
            class={cx('dimmer', {
              active: props.discoverFreeboxStatus === RequestStatus.Getting
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <p>
                <MarkupText id="integration.freebox.setup.description" />
              </p>
              {statusMessage}
              
              {(props.discoverFreeboxStatus === RequestStatus.Success) && (
                
                <div>

                  <div class="alert alert-warning">
                    <strong><Text id="integration.freebox.setup.warning" /></strong> 
                    <Text id="integration.freebox.setup.warningDescription" />
                  </div>

                  {props.appToken === null && (
                    <div class="alert alert-info">
                      <Text id="integration.freebox.setup.firstConnection" />
                    </div>
                  )}

                  <div class="col-md-6">                
                    <div class="card">
                      <div class="card-header">
                        <h3 class="card-title">
                          <Text id="integration.freebox.setup.deviceName" />
                        </h3>
                      </div>
                      <div class="card-body">

                        <div class="form-group">
                          <label>
                            <Text id="integration.freebox.setup.boxModelName" />
                          </label>
                          <input type="text" class="form-control" value={props.boxModelName} disabled />
                        </div>

                        <div class="form-group">
                          <label>
                            <Text id="integration.freebox.setup.boxModel" />
                          </label>
                          <input type="text" class="form-control" value={props.boxModel} disabled />
                        </div>
                        
                        <div
                          class={cx('dimmer', {
                            active: props.authorizedFreeboxStatus === RequestStatus.Getting
                          })}
                        >
                          <div class="loader" />
                          <div class="dimmer-content">
                            {!props.appToken && props.appToken === null && (
                              <button 
                                class="btn btn-success" 
                                onClick={props.connectFreebox}
                              >
                                <Text id="integration.freebox.setup.connectButton" />
                              </button>
                            )}
                            {props.appToken && props.appToken.length > 0 && (
                              <button 
                                class="btn btn-danger" 
                                // onClick={props.connectFreebox}
                              >
                                <Text id="integration.freebox.setup.disconnectButton" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default SetupTab;