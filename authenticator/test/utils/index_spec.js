const createTwitterClient = require('../../src/utils');
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
