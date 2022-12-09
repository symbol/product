const createTwitterClient = require('../../src/utils/createTwitterClient');
const { expect } = require('chai');
const { TwitterApi } = require('twitter-api-v2');

// setup process env
before(() => {
	process.env.TWITTER_APP_KEY = 'KEY';
	process.env.TWITTER_APP_SECRET = 'SECRET';
});

describe('createTwitterClient', () => {
	it('returns twitter api object with app key and app secret included', () => {
		// A
		const twitterApiClient = createTwitterClient();

		// Assert:
		expect(twitterApiClient).to.be.deep.equal(new TwitterApi({
			appKey: 'KEY',
			appSecret: 'SECRET'
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
			appKey: 'KEY',
			appSecret: 'SECRET',
			accessSecret: '123',
			accessToken: '456'
		}));
	});
});
