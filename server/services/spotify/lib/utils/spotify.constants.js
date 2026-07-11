const GLADYS_VARIABLES = {
  CLIENT_ID: 'SPOTIFY_CLIENT_ID',
  CLIENT_SECRET: 'SPOTIFY_CLIENT_SECRET',
  ACCESS_TOKEN: 'SPOTIFY_ACCESS_TOKEN',
  REFRESH_TOKEN: 'SPOTIFY_REFRESH_TOKEN',
};

const SCOPES = ['user-read-playback-state', 'user-modify-playback-state'];

const STATUS = {
  NOT_INITIALIZED: 'not_initialized',
  CONNECTING: 'connecting',
  PROCESSING_TOKEN: 'processing token',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: {
    CONNECTING: 'error connecting',
    PROCESSING_TOKEN: 'error processing token',
  },
};

const BASE_API = 'https://api.spotify.com/v1';
const API = {
  AUTHORIZE: 'https://accounts.spotify.com/authorize',
  TOKEN: 'https://accounts.spotify.com/api/token',
  PLAYER: `${BASE_API}/me/player`,
  DEVICES: `${BASE_API}/me/player/devices`,
  PLAY: `${BASE_API}/me/player/play`,
  PAUSE: `${BASE_API}/me/player/pause`,
  NEXT: `${BASE_API}/me/player/next`,
  PREVIOUS: `${BASE_API}/me/player/previous`,
  VOLUME: `${BASE_API}/me/player/volume`,
};

// Refresh the access token 1 minute before it expires (Spotify tokens last 1 hour)
const TOKEN_EXPIRATION_MARGIN_IN_MS = 60 * 1000;

const PLAYBACK_STATE_POLLING_FREQUENCY_IN_MS = 15 * 1000;

// Delay before refreshing the playback state after a command, the Spotify API
// needs a moment to report the new state
const REFRESH_AFTER_COMMAND_DELAY_IN_MS = 500;

// After a volume command, the Spotify API keeps reporting the old volume for a few
// seconds: don't send back the polled volume during this period or the slider jumps back
const VOLUME_COMMAND_GRACE_PERIOD_IN_MS = 10 * 1000;

module.exports = {
  GLADYS_VARIABLES,
  SCOPES,
  STATUS,
  API,
  TOKEN_EXPIRATION_MARGIN_IN_MS,
  PLAYBACK_STATE_POLLING_FREQUENCY_IN_MS,
  REFRESH_AFTER_COMMAND_DELAY_IN_MS,
  VOLUME_COMMAND_GRACE_PERIOD_IN_MS,
};
