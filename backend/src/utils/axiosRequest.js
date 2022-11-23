const axios = require('axios');

const client = axios.create({
	baseURL: process.env.NEM_ENDPOINT
});

module.exports = client;
