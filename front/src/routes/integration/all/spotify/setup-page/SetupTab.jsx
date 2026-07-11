import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';

import { STATUS } from '../../../../../../../server/services/spotify/lib/utils/spotify.constants';
import { Component } from 'preact';
import { connect } from 'unistore/preact';

class SetupTab extends Component {
  showClientSecretTimer = null;

  toggleClientSecret = () => {
    const { showClientSecret } = this.state;

    if (this.showClientSecretTimer) {
      clearTimeout(this.showClientSecretTimer);
      this.showClientSecretTimer = null;
    }

    this.setState({ showClientSecret: !showClientSecret });

    if (!showClientSecret) {
      this.showClientSecretTimer = setTimeout(() => this.setState({ showClientSecret: false }), 5000);
    }
  };

  componentWillUnmount() {
    if (this.showClientSecretTimer) {
      clearTimeout(this.showClientSecretTimer);
      this.showClientSecretTimer = null;
    }
  }

  render(props, state) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.spotify.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <div
            class={cx('dimmer', {
              active: props.loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              {props.spotifyStatus === STATUS.CONNECTED && (
                <div class="alert alert-success">
                  <Text id="integration.spotify.status.connect" />
                </div>
              )}
              {props.spotifyStatus === STATUS.CONNECTING && (
                <div class="alert alert-info">
                  <Text id="integration.spotify.status.connecting" />
                </div>
              )}
              {props.spotifyStatus === STATUS.PROCESSING_TOKEN && (
                <div class="alert alert-info">
                  <Text id="integration.spotify.status.processingToken" />
                </div>
              )}
              {props.spotifyStatus === STATUS.DISCONNECTED && !props.accessDenied && !props.errored && (
                <div class="alert alert-warning">
                  <Text id="integration.spotify.status.disconnect" />
                </div>
              )}
              {props.accessDenied && (
                <div class="alert alert-danger">
                  <Text id={`integration.spotify.status.errorConnecting.${props.messageAlert}`} />
                </div>
              )}
              {props.errored && (
                <div class="alert alert-danger">
                  <Text id="integration.spotify.status.error" />
                </div>
              )}
              <p>
                <MarkupText id="integration.spotify.setup.description" />
                <MarkupText id="integration.spotify.setup.descriptionCreateProject" />
                <MarkupText
                  id="integration.spotify.setup.descriptionRedirectUri"
                  fields={{ redirectUri: props.redirectUri }}
                />
                <MarkupText id="integration.spotify.setup.descriptionGetKeys" />
              </p>
              {props.loopbackFallback && (
                <div class="alert alert-info">
                  <MarkupText id="integration.spotify.setup.loopbackExplanation" />
                </div>
              )}
              <p>
                <MarkupText id="integration.spotify.setup.descriptionPremium" />
              </p>

              <form>
                <div class="form-group">
                  <label htmlFor="spotifyClientId" className="form-label">
                    <Text id={`integration.spotify.setup.clientIdLabel`} />
                  </label>
                  <Localizer>
                    <input
                      name="spotifyClientId"
                      type="text"
                      placeholder={<Text id="integration.spotify.setup.clientIdPlaceholder" />}
                      value={props.spotifyClientId}
                      className="form-control"
                      autocomplete="off"
                      onInput={props.updateClientId}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label htmlFor="spotifyClientSecret" className="form-label">
                    <Text id={`integration.spotify.setup.clientSecretLabel`} />
                  </label>
                  <div class="input-icon mb-3">
                    <Localizer>
                      <input
                        id="spotifyClientSecret"
                        name="spotifyClientSecret"
                        type={state.showClientSecret ? 'text' : 'password'}
                        placeholder={<Text id="integration.spotify.setup.clientSecretPlaceholder" />}
                        value={props.spotifyClientSecret}
                        className="form-control"
                        autocomplete="off"
                        onInput={props.updateClientSecret}
                      />
                    </Localizer>
                    <span class="input-icon-addon cursor-pointer" onClick={this.toggleClientSecret}>
                      <i
                        class={cx('fe', {
                          'fe-eye': !state.showClientSecret,
                          'fe-eye-off': state.showClientSecret
                        })}
                      />
                    </span>
                  </div>
                </div>

                <div class="form-group">
                  <label htmlFor="spotifySetupConnectionInfo" className="form-label">
                    <Text id="integration.spotify.setup.connectionInfoLabel" />
                  </label>
                </div>
                <div class="form-group">
                  <button type="submit" class="btn btn-success" onClick={props.saveConfiguration}>
                    <Text id="integration.spotify.setup.saveLabel" />
                  </button>
                  {props.connected && (
                    <button type="button" onClick={props.disconnectSpotify} class="btn btn-danger ml-2">
                      <Text id="integration.spotify.setup.disconnectLabel" />
                    </button>
                  )}
                </div>
              </form>

              {props.loopbackFallback && (
                <form>
                  <hr />
                  <div class="form-group">
                    <label htmlFor="spotifyReturnedUrl" className="form-label">
                      <Text id="integration.spotify.setup.returnedUrlLabel" />
                    </label>
                    <Localizer>
                      <input
                        id="spotifyReturnedUrl"
                        name="spotifyReturnedUrl"
                        type="text"
                        placeholder={<Text id="integration.spotify.setup.returnedUrlPlaceholder" />}
                        value={props.returnedUrl}
                        className="form-control"
                        autocomplete="off"
                        onInput={props.updateReturnedUrl}
                      />
                    </Localizer>
                  </div>
                  {props.invalidReturnedUrl && (
                    <div class="alert alert-danger">
                      <Text id="integration.spotify.setup.invalidReturnedUrl" />
                    </div>
                  )}
                  <div class="form-group">
                    <button type="submit" class="btn btn-primary" onClick={props.submitReturnedUrl}>
                      <Text id="integration.spotify.setup.returnedUrlButton" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('user,session,httpClient', {})(SetupTab);
