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

	it('forwards block orderBy queries allowed by the Symbol shell', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				orderBy: 'height'
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
			url: 'https://symbol.node/blocks?orderBy=height',
			timeout: 1234
		});
	});

	it('forwards account search queries allowed by the Symbol shell', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['accounts'],
				order: 'asc',
				pageNumber: '3',
				pageSize: '50'
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
			url: 'https://symbol.node/accounts?order=asc&pageNumber=3&pageSize=50',
			timeout: 1234
		});
	});

	it('forwards mosaic and namespace search queries allowed by the Symbol shell', async () => {
		// Arrange:
		const response = createResponse();
		axios.mockResolvedValue({
			status: 200,
			data: {
				data: []
			}
		});

		// Act:
		await handler({
			method: 'GET',
			query: {
				path: ['mosaics'],
				order: 'desc'
			}
		}, response);
		await handler({
			method: 'GET',
			query: {
				path: ['namespaces'],
				pageSize: '25'
			}
		}, response);

		// Assert:
		expect(axios).toHaveBeenNthCalledWith(1, {
			method: 'get',
			url: 'https://symbol.node/mosaics?order=desc',
			timeout: 1234
		});
		expect(axios).toHaveBeenNthCalledWith(2, {
			method: 'get',
			url: 'https://symbol.node/namespaces?pageSize=25',
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

	it('forwards the inflation receipt statement query used by Symbol block rewards', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['statements', 'transaction'],
				fromHeight: '1234',
				toHeight: '1235',
				receiptType: '20803',
				pageSize: '1000'
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
			url: 'https://symbol.node/statements/transaction?fromHeight=1234&toHeight=1235&receiptType=20803&pageSize=100',
			timeout: 1234
		});
		expect(response.status).toHaveBeenCalledWith(200);
		expect(response.json).toHaveBeenCalledWith({ data: [] });
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

	it('rejects requests when the Symbol node URL is not configured', async () => {
		// Arrange:
		process.env = {};
		const request = {
			method: 'GET',
			query: {
				path: ['blocks']
			}
		};
		const response = createResponse();

		// Act:
		await handler(request, response);

		// Assert:
		expect(axios).not.toHaveBeenCalled();
		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({ message: 'Symbol node URL is not configured.' });
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

	it('rejects malformed query values', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks'],
				pageNumber: '0'
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

	it('rejects malformed typed query values', async () => {
		// Arrange:
		const malformedQueries = [
			{
				path: ['blocks'],
				pageSize: '0'
			},
			{
				path: ['blocks'],
				order: 'sideways'
			},
			{
				path: ['blocks'],
				orderBy: 'timestamp'
			},
			{
				path: ['transactions', 'confirmed'],
				height: '0'
			}
		];

		// Act:
		for (const query of malformedQueries)
			await handler({ method: 'GET', query }, createResponse());

		// Assert:
		expect(axios).not.toHaveBeenCalled();
	});

	it('forwards Symbol node error responses', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks', '1']
			}
		};
		const response = createResponse();
		axios.mockRejectedValue({
			response: {
				status: 404,
				data: {
					code: 'ResourceNotFound'
				}
			}
		});

		// Act:
		await handler(request, response);

		// Assert:
		expect(response.status).toHaveBeenCalledWith(404);
		expect(response.json).toHaveBeenCalledWith({ code: 'ResourceNotFound' });
	});

	it('returns 500 for Symbol node network errors', async () => {
		// Arrange:
		const request = {
			method: 'GET',
			query: {
				path: ['blocks', '1']
			}
		};
		const response = createResponse();
		axios.mockRejectedValue(new Error('network failed'));

		// Act:
		await handler(request, response);

		// Assert:
		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({ message: 'network failed' });
	});
});
