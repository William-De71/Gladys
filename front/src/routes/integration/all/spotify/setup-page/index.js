import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { route } from 'preact-router';
import SetupTab from './SetupTab';
import SpotifyPage from '../SpotifyPage';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../../server/utils/constants';
import { STATUS } from '../../../../../../../server/services/spotify/lib/utils/spotify.constants';
import { RequestStatus } from '../../../../../utils/consts';

class SpotifySetupPage extends Component {
  loadConfiguration = async () => {
    try {
      const configuration = await this.props.httpClient.get('/api/v1/service/spotify/configuration');
      this.setState({
        spotifyClientId: configuration.clientId,
        spotifyClientSecret: configuration.clientSecret
      });
    } catch (e) {
      console.error(e);
      this.setState({ errored: true });
    }
  };

  loadStatus = async () => {
    try {
      const spotifyStatus = await this.props.httpClient.get('/api/v1/service/spotify/status');
      this.setState({
        spotifyStatus: spotifyStatus.status,
        connected: spotifyStatus.connected,
        configured: spotifyStatus.configured
      });
    } catch (e) {
      console.error(e);
      this.setState({ errored: true });
    }
  };

  detectCode = async () => {
    if (this.props.error) {
      this.setState({
        spotifyStatus: STATUS.DISCONNECTED,
        connected: false,
        accessDenied: true,
        messageAlert: this.props.error === 'access_denied' ? 'access_denied' : 'other_error'
      });
      return;
    }
    if (this.props.code && this.props.state) {
      await this.exchangeCode(this.props.code, this.props.state);
    }
  };

  exchangeCode = async (code, state) => {
    try {
      this.setState({
        spotifyStatus: STATUS.PROCESSING_TOKEN,
        connected: false,
        accessDenied: false,
        invalidReturnedUrl: false
      });
      await this.props.httpClient.post('/api/v1/service/spotify/token', {
        codeOAuth: code,
        redirectUri: this.getRedirectUri(),
        state
      });
      this.setState({
        spotifyStatus: STATUS.CONNECTED,
        connected: true,
        configured: true,
        errored: false
      });
      setTimeout(() => {
        route('/dashboard/integration/device/spotify/discover', true);
      }, 100);
    } catch (e) {
      console.error(e);
      this.setState({
        spotifyStatus: STATUS.DISCONNECTED,
        connected: false,
        errored: true
      });
    }
  };

  // Spotify only accepts HTTPS redirect URIs, except the 127.0.0.1 loopback. Spotify never
  // contacts this URL itself (it is a browser redirect), so on a self-hosted HTTP install we
  // register the loopback: the user then copy-pastes the returned URL on this page.
  isLoopbackFallback = () => {
    const { protocol, hostname } = window.location;
    return protocol !== 'https:' && hostname !== '127.0.0.1' && hostname !== '[::1]';
  };

  getRedirectUri = () => {
    const { port } = window.location;
    const origin = this.isLoopbackFallback() ? `http://127.0.0.1${port ? `:${port}` : ''}` : window.location.origin;
    return `${origin}/dashboard/integration/device/spotify/setup`;
  };

  updateReturnedUrl = e => {
    this.setState({ returnedUrl: e.target.value });
  };

  submitReturnedUrl = async e => {
    e.preventDefault();
    const text = (this.state.returnedUrl || '').trim();
    const queryString = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
    const params = new URLSearchParams(queryString);
    const error = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (error) {
      this.setState({
        spotifyStatus: STATUS.DISCONNECTED,
        connected: false,
        accessDenied: true,
        messageAlert: error === 'access_denied' ? 'access_denied' : 'other_error'
      });
      return;
    }
    if (!code || !state) {
      this.setState({ invalidReturnedUrl: true });
      return;
    }
    this.setState({ returnedUrl: '' });
    await this.exchangeCode(code, state);
  };

  saveConfiguration = async e => {
    e.preventDefault();
    try {
      await this.props.httpClient.post('/api/v1/service/spotify/configuration', {
        clientId: this.state.spotifyClientId,
        clientSecret: this.state.spotifyClientSecret
      });
      this.setState({
        spotifySaveSettingsStatus: RequestStatus.Success
      });
    } catch (e) {
      console.error(e);
      this.setState({
        spotifySaveSettingsStatus: RequestStatus.Error,
        errored: true
      });
      return;
    }
    try {
      this.setState({
        spotifyStatus: STATUS.CONNECTING,
        connected: false,
        configured: true
      });
      const result = await this.props.httpClient.post('/api/v1/service/spotify/connect');
      const authUrl = `${result.authUrl}&redirect_uri=${encodeURIComponent(this.getRedirectUri())}`;
      if (this.isLoopbackFallback()) {
        // Keep this page open: the user will paste the returned URL here to finish the connection
        window.open(authUrl, '_blank');
      } else {
        window.location.href = authUrl;
      }
    } catch (e) {
      console.error('Error when redirecting to Spotify', e);
      this.setState({
        spotifyStatus: STATUS.DISCONNECTED,
        connected: false,
        errored: true
      });
    }
  };

  disconnectSpotify = async () => {
    try {
      await this.props.httpClient.post('/api/v1/service/spotify/disconnect');
      this.setState({
        spotifyStatus: STATUS.DISCONNECTED,
        connected: false
      });
    } catch (e) {
      console.error(e);
      this.setState({ errored: true });
    }
  };

  updateStatus = async state => {
    this.setState({
      spotifyStatus: state.status,
      connected: state.status === STATUS.CONNECTED
    });
  };

  updateClientId = e => {
    this.setState({ spotifyClientId: e.target.value });
  };

  updateClientSecret = e => {
    this.setState({ spotifyClientSecret: e.target.value });
  };

  init = async () => {
    this.setState({ loading: true, errored: false });
    await Promise.all([this.loadConfiguration(), this.loadStatus()]);
    await this.detectCode();
    this.setState({ loading: false });
  };

  componentDidMount() {
    this.init();
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.SPOTIFY.STATUS, this.updateStatus);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.SPOTIFY.STATUS, this.updateStatus);
  }

  render(props, state) {
    return (
      <SpotifyPage user={props.user}>
        <SetupTab
          {...props}
          {...state}
          redirectUri={this.getRedirectUri()}
          loopbackFallback={this.isLoopbackFallback()}
          updateClientId={this.updateClientId}
          updateClientSecret={this.updateClientSecret}
          updateReturnedUrl={this.updateReturnedUrl}
          submitReturnedUrl={this.submitReturnedUrl}
          saveConfiguration={this.saveConfiguration}
          disconnectSpotify={this.disconnectSpotify}
        />
      </SpotifyPage>
    );
  }
}

export default connect('user,session,httpClient', {})(SpotifySetupPage);
