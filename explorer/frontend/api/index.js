import * as nemAPI from './nem';
import * as symbolAPI from './symbol';
import config from '@/config';

const listOfAPIs = {
	nem: nemAPI,
	symbol: symbolAPI
};

const api = listOfAPIs[config.PLATFORM];

if (!api)
	throw new Error(`Platform "${config.PLATFORM}" has no API implementation.`);

export default api;
