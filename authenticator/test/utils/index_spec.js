const { createTwitterClient, decrypt, encrypt } = require('../../src/utils');
const { expect } = require('chai');
const { TwitterApi } = require('twitter-api-v2');

describe('createTwitterClient', () => {
	it('returns twitter api object with app key and app secret included', () => {
		// Arrange + Act:
		const twitterApiClient = createTwitterClient();

		// Assert:
		expect(twitterApiClient).to.be.deep.equal(new TwitterApi({
			appKey: 'twitterAppKey',
			appSecret: 'twitterAppSecret'
		}));
	});

	it('returns twitter api object with credentials included', () => {
		// Arrange + Act:
		const twitterApiClient = createTwitterClient({
			accessSecret: '123',
			accessToken: '456'
		});

		// Assert:
		expect(twitterApiClient).to.be.deep.equal(new TwitterApi({
			appKey: 'twitterAppKey',
			appSecret: 'twitterAppSecret',
			accessSecret: '123',
			accessToken: '456'
		}));
	});
});

describe('crypto encrypt / decrypt', () => {
	it('returns encrypted hex string', () => {
		// Act:
		const result = encrypt('oauth-token-secret');

		// Assert:
		const textParts = result.split(':');
		// vi is 16 bytes
		expect(textParts[0].length).to.be.equal(32);
		// auth tag is 16 bytes
		expect(textParts[1].length).to.be.equal(32);
		// encrypted text is 18 bytes
		expect(textParts[2].length).to.be.equal(36);
		expect(result.length).to.be.equal(102);
		expect(decrypt(result)).to.be.equal('oauth-token-secret');
	});

	it('return decrypt value from encrypted string', () => {
		// Act:
		const result = decrypt('ccd36d217a5a498545a5e24be0455f3d:70b6a18de851f0e530d562d544bf60f0:17798b8c1e14e7e1fff849f217c0bac3293d');

		// Assert:
		expect(result).to.be.equal('oauth-token-secret');
	});

	it('round trip', () => {
		// Arrange:
		const text = 'test-round-trip';

		// Act:
		const encrypted = encrypt(text);

		// Assert:
		expect(decrypt(encrypted)).to.be.equal(text);
	});
});
