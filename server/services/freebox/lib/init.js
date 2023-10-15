/**
 * @description Prepares service and starts connection.
 * @example
 * init();
 */
async function init() {
  
  await this.discoverFreebox();
  
}

module.exports = {
  init,
};
