const twitter = require('../../src/controllers/twitter');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const {
	stub, restore
} = require('sinon');
const sinonChai = require('sinon-chai');
const { TwitterApi } = require('twitter-api-v2');

chai.use(chaiAsPromised);
chai.use(sinonChai);
const { expect } = chai;

describe('twitter controller', () => {
	describe('requestToken', () => {
		let generateAuthLinkStub = {};

		beforeEach(() => {
			generateAuthLinkStub = stub(TwitterApi.prototype, 'generateAuthLink');
		});

		afterEach(restore);

		it('returns oauth token from twitter', async () => {
			// Arrange:
			const twitterAuthResponse = {
				oauth_callback_confirmed: 'true',
				oauth_token: 'token',
				oauth_token_secret: 'secret',
				url: 'http://localhost'
			};

			generateAuthLinkStub.returns(Promise.resolve(twitterAuthResponse));

			// Act:
			const result = await twitter.requestToken();

			// Assert:
			expect(generateAuthLinkStub).to.have.been.calledWith('http://127.0.0.1:3000');
			expect(result).to.be.deep.equal({
				oauthToken: twitterAuthResponse.oauth_token,
				oauthTokenSecret: twitterAuthResponse.oauth_token_secret,
				url: twitterAuthResponse.url
			});
		});

		it('throws error when request token fail', async () => {
			// Arrange:
			generateAuthLinkStub.throws();

			// Act:
			const promise = twitter.requestToken();

			// Assert:
			await expect(promise).to.be.rejectedWith('fail to request twitter token');
		});
	});

	describe('userAccess', () => {
		let loginStub = {};

		beforeEach(() => {
			loginStub = stub(TwitterApi.prototype, 'login');
		});

		afterEach(restore);

		it('returns login info from twitter', async () => {
			// Arrange:
			const twitterLoginResponse = {
				screenName: 'twitterAccount',
				accessToken: 'token1234',
				accessSecret: 'secret1234',
				client: {
					v2: {
						me: () => ({
							data: {
								public_metrics: {
									followers_count: 3
								},
								created_at: '12345'
							}
						})
					}
				}
			};

			loginStub.returns(Promise.resolve(twitterLoginResponse));

			// Act:
			const result = await twitter.userAccess({
				oauthToken: 'token',
				oauthTokenSecret: 'secret',
				oauthVerifier: 'verifier'
			});

			// Assert:
			expect(loginStub).to.have.been.calledWith('verifier');
			expect(result).to.be.deep.equal({
				accessSecret: 'secret1234',
				accessToken: 'token1234',
				screenName: 'twitterAccount',
				followersCount: 3,
				createdAt: '12345'
			});
		});

		it('throws error when request token fail', async () => {
			// Arrange:
			loginStub.throws();

			// Act:
			const promise = twitter.userAccess({
				oauthToken: 'token',
				oauthTokenSecret: 'secret',
				oauthVerifier: 'verifier'
			});

			// Assert:
			await expect(promise).to.be.rejectedWith('fail to request user access token');
		});
	});
});
