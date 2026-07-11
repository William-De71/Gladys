import { Component } from 'preact';
import cx from 'classnames';
import { connect } from 'unistore/preact';

import {
  WEBSOCKET_MESSAGE_TYPES,
  DEVICE_FEATURE_TYPES,
  MUSIC_PLAYBACK_STATE
} from '../../../../../server/utils/constants';
import style from './style.css';

const formatDuration = ms => {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

class MusicComponent extends Component {
  state = {
    isPlaying: null
  };
  getDevice = async () => {
    try {
      await this.setState({
        error: false
      });
      const musicDevice = await this.props.httpClient.get(`/api/v1/device/${this.props.box.device}`, {});
      const playFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.PLAY);
      const pauseFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.PAUSE);
      const previousFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.PREVIOUS);
      const nextFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.NEXT);
      const volumeFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.VOLUME);
      const playBackStateFeature = musicDevice.features.find(f => f.type === DEVICE_FEATURE_TYPES.MUSIC.PLAYBACK_STATE);
      const isPlaying = playBackStateFeature.last_value === MUSIC_PLAYBACK_STATE.PLAYING;
      // Spotify devices expose the current track details through the Spotify service
      const spotifyDeviceId = musicDevice.external_id.startsWith('spotify:')
        ? musicDevice.external_id.split(':')[1]
        : null;
      this.setState({
        musicDevice,
        playFeature,
        pauseFeature,
        previousFeature,
        nextFeature,
        volumeFeature,
        playBackStateFeature,
        isPlaying,
        spotifyDeviceId
      });
      if (spotifyDeviceId) {
        await this.getSpotifyPlayback();
      }
    } catch (e) {
      console.error(e);
      this.setState({
        error: true
      });
    }
  };

  getSpotifyPlayback = async () => {
    try {
      const playback = await this.props.httpClient.get('/api/v1/service/spotify/player');
      this.setSpotifyPlayback(playback);
    } catch (e) {
      console.error(e);
    }
  };

  setSpotifyPlayback = playback => {
    // The Spotify account has a single active playback, display it whatever the device playing
    if (playback) {
      this.setState({
        spotifyPlayback: playback,
        spotifyPlaybackReceivedAt: Date.now()
      });
    } else {
      this.setState({ spotifyPlayback: null });
    }
  };

  updateSpotifyPlaybackWebsocket = payload => {
    if (this.state.spotifyDeviceId) {
      this.setSpotifyPlayback(payload);
    }
  };

  getCurrentProgressMs = () => {
    const { spotifyPlayback, spotifyPlaybackReceivedAt } = this.state;
    if (!spotifyPlayback) {
      return 0;
    }
    if (!spotifyPlayback.isPlaying) {
      return spotifyPlayback.progressMs;
    }
    return Math.min(spotifyPlayback.progressMs + (Date.now() - spotifyPlaybackReceivedAt), spotifyPlayback.durationMs);
  };

  setValueDevice = async (deviceFeature, value) => {
    try {
      await this.setState({ error: false });
      await this.props.httpClient.post(`/api/v1/device_feature/${deviceFeature.selector}/value`, {
        value
      });
    } catch (e) {
      console.error(e);
      this.setState({ error: true });
    }
  };

  play = async () => {
    await this.setState({ isPlaying: true });
    await this.setValueDevice(this.state.playFeature, 1);
  };
  pause = async () => {
    await this.setState({ isPlaying: false });
    await this.setValueDevice(this.state.pauseFeature, 1);
  };
  next = async () => {
    await this.setValueDevice(this.state.nextFeature, 1);
  };
  previous = async () => {
    await this.setValueDevice(this.state.previousFeature, 1);
  };
  // Update the local state while dragging, so the periodic re-renders
  // don't reset the slider thumb to the previous value mid-drag
  updateVolume = e => {
    const volume = parseInt(e.target.value, 10);
    const newVolumeFeature = { ...this.state.volumeFeature, last_value: volume };
    this.setState({ volumeFeature: newVolumeFeature });
  };
  // Only send the command when the slider is released
  changeVolume = async e => {
    const volume = parseInt(e.target.value, 10);
    this.updateVolume(e);
    await this.setValueDevice(this.state.volumeFeature, volume);
  };

  updateDeviceStateWebsocket = payload => {
    if (payload.device_feature_selector === this.state.playBackStateFeature.selector) {
      const isPlaying = payload.last_value === MUSIC_PLAYBACK_STATE.PLAYING;
      this.setState({ isPlaying });
    }
    if (payload.device_feature_selector === this.state.volumeFeature.selector) {
      const newVolumeFeature = { ...this.state.volumeFeature, last_value: payload.last_value };
      this.setState({ volumeFeature: newVolumeFeature });
    }
  };

  handleWebsocketConnected = ({ connected }) => {
    // When the websocket is disconnected, we refresh the data when the websocket is reconnected
    if (!connected) {
      this.wasDisconnected = true;
    } else if (this.wasDisconnected) {
      this.getDevice();
      this.wasDisconnected = false;
    }
  };

  componentDidMount() {
    this.getDevice();
    this.props.session.dispatcher.addListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.addListener(
      WEBSOCKET_MESSAGE_TYPES.SPOTIFY.PLAYBACK,
      this.updateSpotifyPlaybackWebsocket
    );
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
    // Re-render every second so the progress bar moves between two refreshes
    this.progressTimer = setInterval(() => {
      if (this.state.spotifyPlayback && this.state.spotifyPlayback.isPlaying) {
        this.setState({ progressTick: Date.now() });
      }
    }, 1000);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.SPOTIFY.PLAYBACK,
      this.updateSpotifyPlaybackWebsocket
    );
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
    clearInterval(this.progressTimer);
  }

  render(props, { isPlaying, musicDevice, previousFeature, nextFeature, volumeFeature, spotifyPlayback }) {
    const progressMs = this.getCurrentProgressMs();
    const progressPercent =
      spotifyPlayback && spotifyPlayback.durationMs > 0 ? (progressMs / spotifyPlayback.durationMs) * 100 : 0;
    return (
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{musicDevice && musicDevice.name}</h3>
        </div>
        <div class="card-body">
          {spotifyPlayback && (
            <div class="mb-4">
              <div class="d-flex align-items-center">
                {spotifyPlayback.artworkUrl && (
                  <img
                    src={spotifyPlayback.artworkUrl}
                    alt={spotifyPlayback.albumName}
                    class={cx('dark-mode-no-invert', style.artwork)}
                  />
                )}
                <div class={style.trackInfo}>
                  <div class={style.trackName}>{spotifyPlayback.trackName}</div>
                  <div class="text-muted">{spotifyPlayback.artists}</div>
                  <small class="text-muted">{spotifyPlayback.albumName}</small>
                </div>
              </div>
              {spotifyPlayback.durationMs > 0 && (
                <div class="mt-3">
                  <div class={cx('progress', style.progress)}>
                    <div class="progress-bar bg-green" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div class="d-flex justify-content-between">
                    <small class="text-muted">{formatDuration(progressMs)}</small>
                    <small class="text-muted">{formatDuration(spotifyPlayback.durationMs)}</small>
                  </div>
                </div>
              )}
            </div>
          )}
          <div class="row">
            <div class="col">
              {previousFeature && (
                <button class="btn btn-block btn-secondary" onClick={this.previous}>
                  <i class="fe fe-skip-back" />
                </button>
              )}
            </div>
            <div class="col">
              {!isPlaying && (
                <button class="btn btn-block btn-secondary" onClick={this.play}>
                  <i class="fe fe-play" />
                </button>
              )}
              {isPlaying && (
                <button class="btn btn-block btn-secondary" onClick={this.pause}>
                  <i class="fe fe-pause" />
                </button>
              )}
            </div>
            <div class="col">
              {nextFeature && (
                <button class="btn btn-block btn-secondary" onClick={this.next}>
                  <i class="fe fe-skip-forward" />
                </button>
              )}
            </div>
          </div>
          {volumeFeature && (
            <div class="row mt-4">
              <div class="col">
                <input
                  type="range"
                  value={volumeFeature.last_value}
                  onInput={this.updateVolume}
                  onChange={this.changeVolume}
                  class="custom-range"
                  step="1"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default connect('httpClient,session', {})(MusicComponent);
