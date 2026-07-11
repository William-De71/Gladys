/**
 * @description Get Spotify status.
 * @returns {object} Current Spotify service status.
 * @example
 * spotify.getStatus();
 */
function getStatus() {
  return {
    configured: this.configured,
    connected: this.connected,
    status: this.status,
  };
}

module.exports = {
  getStatus,
};
