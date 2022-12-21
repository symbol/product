const { config } = require('../config');
const axios = require('axios');

const client = axios.create({
	baseURL: config.nemEndpoint
});

module.exports = client;
