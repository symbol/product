import { jest } from '@jest/globals';

// Mocks for ethers namespace import
const networkFromMock = jest.fn().mockReturnValue({ chainId: 1, name: 'mainnet' });
const JsonRpcProviderMock = jest.fn().mockImplementation(function (url, network, options) {
	this.url = url;
	this.network = network;
	this.options = options;
});
const ContractMock = jest.fn().mockImplementation(function (address, abi, provider) {
	this.address = address;
	this.abi = abi;
	this.provider = provider;
});

jest.unstable_mockModule('ethers', async () => {
	return {
		ethers: {
			JsonRpcProvider: JsonRpcProviderMock,
			Contract: ContractMock,
			Network: { from: networkFromMock }
		}
	};
});

const { makeEthereumJrpcCall, createEthereumJrpcProvider, createContract } = await import('../../src/utils/jrpc');

// Reusable constants
const nodeUrl = 'http://localhost:8545';
const chainId = 1;

describe('utils/jrpc', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('makeEthereumJrpcCall', () => {
		it('makes a JSON-RPC POST request and returns result', async () => {
			// Arrange:
			const method = 'eth_chainId';
			const params = [];
			const expectedResult = '0x1';
			const makeRequest = jest.fn().mockResolvedValue({ result: expectedResult });

			// Act:
			const result = await makeEthereumJrpcCall(makeRequest, nodeUrl, method, params);

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
			const [passedUrl, options] = makeRequest.mock.calls[0];
			expect(passedUrl).toBe(nodeUrl);
			expect(options.method).toBe('POST');
			expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
			const parsedBody = JSON.parse(options.body);
			expect(parsedBody).toEqual({
				jsonrpc: '2.0',
				id: 1,
				method,
				params
			});
			expect(result).toBe(expectedResult);
		});
	});

	describe('createEthereumJrpcProvider', () => {
		it('creates JsonRpcProvider with static network from chainId', () => {
			// Arrange:
			const input = { nodeUrl, chainId };
			const expectedStaticNetwork = networkFromMock.mock.results.length
				? networkFromMock.mock.results[0].value
				: { chainId: 1, name: 'mainnet' };

			// Act:
			const provider = createEthereumJrpcProvider(input);

			// Assert:
			expect(networkFromMock).toHaveBeenCalledWith(chainId);
			expect(JsonRpcProviderMock).toHaveBeenCalledWith(
				nodeUrl,
				null,
				{ staticNetwork: expectedStaticNetwork }
			);
			expect(provider).toBeInstanceOf(JsonRpcProviderMock);
		});
	});

	describe('createContract', () => {
		it('creates ethers.Contract with address, abi, provider', () => {
			// Arrange:
			const abi = ['function symbol() view returns (string)'];
			const address = '0xToken';
			const provider = { kind: 'mockProvider' };

			// Act:
			const contract = createContract(abi, address, provider);

			// Assert:
			expect(ContractMock).toHaveBeenCalledWith(address, abi, provider);
			expect(contract).toBeInstanceOf(ContractMock);
		});
	});
});
