import { makeGetRequest } from '@/utils/server';
import axios from 'axios';

jest.mock('axios');

describe('server requests', () => {
	it('forwards an abort signal to axios', async () => {
		// Arrange:
		const { signal } = new AbortController();
		axios.get.mockResolvedValue({ data: { enabled: true } });

		// Act:
		const response = await makeGetRequest('https://bridge.example', { signal, timeout: 5000 });

		// Assert:
		expect(response).toEqual({ enabled: true });
		expect(axios.get).toHaveBeenCalledWith('https://bridge.example', {
			signal,
			timeout: 5000
		});
	});

	it('cancellation error when the signal is aborted', async () => {
		// Arrange:
		const abortController = new AbortController();
		const cancellationError = Object.assign(new Error('canceled'), { name: 'CanceledError' });
		axios.get.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
			signal.addEventListener('abort', () => reject(cancellationError));
		}));

		// Act:
		const request = makeGetRequest('https://bridge.example', { signal: abortController.signal });
		abortController.abort();

		// Assert:
		expect(abortController.signal.aborted).toBe(true);
		await expect(request).rejects.toBe(cancellationError);
	});
});
