import handler from '@/pages/api/symbol-node/[...path]';
import axios from 'axios';

jest.mock('axios');

describe('pages/api/symbol-node/[...path]', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
		jest.resetAllMocks();
	});

	it('proxies repeated query parameters without collapsing arrays', async () => {
		// Arrange:
		process.env.NEXT_PUBLIC_SYMBOL_NODE_URL = 'https://symbol.node';
		process.env.NEXT_PUBLIC_REQUEST_TIMEOUT = '60000';
		axios.mockResolvedValue({
			status: 200,
			data: {
				data: []
			}
		});
		const req = {
			method: 'GET',
			query: {
				path: ['transactions', 'confirmed'],
				type: ['16705', '16961'],
				pageSize: '10'
			}
		};
		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn()
		};

		// Act:
		await handler(req, res);

		// Assert:
		expect(axios).toHaveBeenCalledWith(expect.objectContaining({
			timeout: 60000,
			url: 'https://symbol.node/transactions/confirmed?type=16705&type=16961&pageSize=10'
		}));
		expect(res.status).toHaveBeenCalledWith(200);
	});
});
