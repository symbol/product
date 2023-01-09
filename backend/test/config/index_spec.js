import { config, validateConfiguration } from '../../src/config/index.js';
import { expect } from 'chai';

describe('config', () => {
	const expectedConfig = {
		port: 5001,
		mosaicDivisibility: 6,
		minFollowers: 10,
		minAccountAge: 30,
		receiptMaxBalance: 200000000,
		sendOutMaxAmount: 500000000,
		network: 'testnet',
		nemFaucetPrivateKey: '1b5061d58cc82ab272b597a660304f974dc6ffc2698c103f4cba1fab1215c632',
		nemEndpoint: 'http://localhost:7890',
		jwtSecret: 'hello'
	};

	const faucetConfigurationError = 'provided nem faucet private key or endpoint configuration is incomplete';
	const jwtConfigurationError = 'provided jwt configuration is incomplete';

	const assertFaucetInvalidConfig = (missingConfig, expectedError) => {
		// Arrange:
		const invalidConfig = { ...expectedConfig };

		delete invalidConfig[missingConfig];

		// Act + Assert:
		expect(() => validateConfiguration(invalidConfig)).throw(expectedError);
	};

	it('returns config variable', () => {
		// Arrange + Act + Assert:
		expect(() => validateConfiguration(expectedConfig)).not.throw();
		expect(config).to.be.deep.equal(expectedConfig);
	});

	it('throws error when nem faucet private key missing in config', () => {
		assertFaucetInvalidConfig('nemFaucetPrivateKey', faucetConfigurationError);
	});

	it('throws error when nem endpoint missing in config', () => {
		assertFaucetInvalidConfig('nemEndpoint', faucetConfigurationError);
	});

	it('throws error when jwtSecret missing in config', () => {
		assertFaucetInvalidConfig('jwtSecret', jwtConfigurationError);
	});
});
