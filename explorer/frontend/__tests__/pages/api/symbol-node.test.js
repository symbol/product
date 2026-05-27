import handler from '@/pages/api/symbol-node/[...path]';
import axios from 'axios';

jest.mock('axios');

describe('pages/api/symbol-node', () => {
	const originalEnv = process.env;

	const createResponse = () => {
		const response = {
			json: jest.fn(() => response),
			setHeader: jest.fn(() => response),
			status: jest.fn(() => response)
		};

		return response;
	};

	beforeEach(() => {
		process.env = {
			...originalEnv,
			NEXT_PUBLIC_SYMBOL_NODE_URL: 'https://symbol.node',
			NEXT_PUBLIC_REQUEST_TIMEOUT: '1234'
		};
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it('forwards allowed GET requests to the configured Symbol node', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				pageNumber: '2'
			}
		};
		const response = createResponse();
		axios.mockResolvedValue({
			status: 200,
			data: {
				data: []
			}
		});

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).toHaveBeenCalledWith({
			method: 'get',
			url: 'https://symbol.node/blocks?pageNumber=2',
			timeout: 1234
		});
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.json).toHaveBeenCalledWith({ data: [] });
	});

	it('normalizes allowed query parameters before forwarding them', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				pageNumber: '2',
				pageSize: '1000',
				order: 'desc'
			}
		};
		const response = createResponse();
		axios.mockResolvedValue({
			status: 200,
			data: {
				data: []
			}
		});

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).toHaveBeenCalledWith({
			method: 'get',
			url: 'https://symbol.node/blocks?pageNumber=2&pageSize=100&order=desc',
			timeout: 1234
		});
	});

	it('forwards the transaction query parameters used by the Symbol shell', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['transactions', 'confirmed'],
				address: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY',
				height: '3410446',
				orderBy: 'id'
			}
		};
		const response = createResponse();
		axios.mockResolvedValue({
			status: 200,
			data: {
				data: []
			}
		});

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).toHaveBeenCalledWith({
			method: 'get',
			url: 'https://symbol.node/transactions/confirmed?address=TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY&height=3410446&orderBy=id',
			timeout: 1234
		});
	});

	it('rejects non-GET requests', async () => {
		// Arrange:
		const request = {
			method: 'POST',
			query: {
				path: ['blocks']
			}
		};
		const response = createResponse();

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).not.toHaveBeenCalled();
		expect(response.setHeader).toHaveBeenCalledWith('Allow', 'GET');
		expect(response.status).toHaveBeenCalledWith(405);
		expect(response.json).toHaveBeenCalledWith({ message: 'Method not allowed.' });
	});

	it('rejects paths outside the Symbol shell allowlist', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['transactions']
			}
		};
		const response = createResponse();

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).not.toHaveBeenCalled();
		expect(response.status).toHaveBeenCalledWith(403);
		expect(response.json).toHaveBeenCalledWith({ message: 'Symbol node path is not allowed.' });
	});

	it('rejects query parameters outside the Symbol shell allowlist', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				limit: '1000'
			}
		};
		const response = createResponse();

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).not.toHaveBeenCalled();
		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({ message: 'Symbol node query is not allowed.' });
	});

	it('rejects Symbol query parameters not used by the current shell connection', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				signerPublicKey: 'AC1A6E1D8DE5B17D2C6B1293F1CAD3829EEACF38D09311BB3C8E5A880092DE26'
			}
		};
		const response = createResponse();

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).not.toHaveBeenCalled();
		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({ message: 'Symbol node query is not allowed.' });
	});
});
