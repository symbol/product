import axios from 'axios';

export const client = nodeUrl => axios.create({
	baseURL: nodeUrl
});

/**
 * Handle Axios error response.
 * @param {Error} error Axios error.
 */
export const axiosErrorHandler = error => {
	if (error.response) {
		// The request was made and the server responded with a status code
		// that falls out of the range of 2xx
		throw new Error(error.response.data.message);
	} else if (error.request) {
		// The request was made but no response was received
		throw new Error('node is not responding');
	} else {
		// Something happened in setting up the request that triggered an Error
		throw new Error('unable to process request');
	}
};
