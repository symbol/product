const { config, validateConfiguration } = require('../../src/config');
const { expect } = require('chai');

describe('config', () => {
	const expectedConfig = {
		port: '5002',
		twitterAppKey: 'twitterAppKey',
		twitterAppSecret: 'twitterAppSecret',
		twitterCallbackUrl: 'http://127.0.0.1:3000',
		jwtSecret: 'hello'
	};

	const twitterConfigurationError = 'provided twitter configuration is incomplete';
	const jwtConfigurationError = 'provided jwt configuration is incomplete';

	const assertTwitterInvalidConfig = (missingConfig, expectedError) => {
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

	it('throws error when twitterAppKey missing in config', () => {
		assertTwitterInvalidConfig('twitterAppKey', twitterConfigurationError);
	});

	it('throws error when twitterAppSecret missing in config', () => {
		assertTwitterInvalidConfig('twitterAppSecret', twitterConfigurationError);
	});

	it('throws error when twitterCallbackUrl missing in config', () => {
		assertTwitterInvalidConfig('twitterCallbackUrl', twitterConfigurationError);
	});

	it('throws error when jwtSecret missing in config', () => {
		assertTwitterInvalidConfig('jwtSecret', jwtConfigurationError);
	});
});
