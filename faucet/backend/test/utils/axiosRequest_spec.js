import { axiosErrorHandler } from '../../src/utils/axiosRequest.js';
import { expect } from 'chai';

describe('axiosRequest', () => {
	describe('axiosErrorHandler', () => {
		const assertAxiosError = (error, errorMessage) => {
			expect(() => axiosErrorHandler(error)).throw(errorMessage);
		};

		it('throws error when response properties present', () => {
			assertAxiosError({
				response: {
					data: {
						message: 'error message from server'
					}
				}
			}, 'error message from server');
		});

		it('throws error when request properties present', () => {
			assertAxiosError({
				request: {}
			}, 'node is not responding');
		});

		it('throws error when neither response nor request properties are present', () => {
			assertAxiosError({}, 'unable to process request');
		});
	});
});
