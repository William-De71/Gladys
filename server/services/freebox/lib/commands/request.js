const https = require('node:https');
const axios = require('axios');
const { FREEBOX_ROOT_CA } = require('../utils/constants');

/**
 * @description Create Axios https request associated TLS certificate.
 * @param {object} requestConfig - Request configuration. 
 * @returns {Promise} Return request response.
 * @example
 * request(requestConfig);
 */
async function request(requestConfig) {

    const httpsAgentConfig = {ca: FREEBOX_ROOT_CA, rejectUnauthorized: false};

    this.axiosInstance = axios.create({
        httpsAgent: new https.Agent(httpsAgentConfig),
    });

    return this.axiosInstance.request(requestConfig);
}

module.exports = {
    request,
  };
  