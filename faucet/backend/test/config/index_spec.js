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
		jwtSecret: 'hello',
		nem: {
			faucetPrivateKey: '1b5061d58cc82ab272b597a660304f974dc6ffc2698c103f4cba1fab1215c632',
			endpoint: 'http://localhost:7890'
		},
		symbol: {
			faucetPrivateKey: '97B1D110B687908FD020885B14F42BB17E3E1107B723F23A4AD1E0E0C9CBBD78',
			endpoint: 'http://localhost:3001'
		},
		dbPath: ':memory:'
	};

	const nemFaucetConfigurationError = 'provided nem faucet private key or endpoint configuration is incomplete';
	const symbolFaucetConfigurationError = 'provided symbol faucet private key or endpoint configuration is incomplete';
	const jwtConfigurationError = 'provided jwt configuration is incomplete';

	const runPrivateKeyAndEndpointCheckTests = (protocol, expectedError) => {
		it(`throws error when ${protocol} faucet private key missing in config`, () => {
			// Arrange:
			const invalidConfig = {
				...expectedConfig,
				[protocol]: {
					endpoint: 'value'
				}
			};

			// Act + Assert:
			expect(() => validateConfiguration(invalidConfig)).throw(expectedError);
		});

		it(`throws error when ${protocol} endpoint missing in config`, () => {
			// Arrange:
			const invalidConfig = {
				...expectedConfig,
				[protocol]: {
					faucetPrivateKey: 'value'
				}
			};

			// Act + Assert:
			expect(() => validateConfiguration(invalidConfig)).throw(expectedError);
		});
	};

	it('returns config variable', () => {
		// Arrange + Act + Assert:
		expect(() => validateConfiguration(expectedConfig)).not.throw();
		expect(config).to.be.deep.equal(expectedConfig);
	});

	runPrivateKeyAndEndpointCheckTests('nem', nemFaucetConfigurationError);

	runPrivateKeyAndEndpointCheckTests('symbol', symbolFaucetConfigurationError);

	it('throws error when jwtSecret missing in config', () => {
		// Arrange:
		const invalidConfig = { ...expectedConfig };

		delete invalidConfig.jwtSecret;

		// Act + Assert:
		expect(() => validateConfiguration(invalidConfig)).throw(jwtConfigurationError);
	});
});
