import { config } from '../config/index.js';
import axios from 'axios';

const client = axios.create({
	baseURL: config.nemEndpoint
});

export default client;
