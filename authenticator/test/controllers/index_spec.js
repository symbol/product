const twitter = require('../../src/controllers');
const { decrypt } = require('../../src/utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { decode } = require('jsonwebtoken');
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
			const { oauthTokenSecret, ...info } = await twitter.requestToken();

			// Assert:
			expect(generateAuthLinkStub).to.have.been.calledWith('http://127.0.0.1:3000');
			expect(info).to.be.deep.equal({
				oauthToken: twitterAuthResponse.oauth_token,
				url: twitterAuthResponse.url
			});
			expect(decrypt(oauthTokenSecret)).to.be.equal(twitterAuthResponse.oauth_token_secret);
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

		// decrypt value: oauth-token-secret
		const validOauthTokenSecret = 'ccd36d217a5a498545a5e24be0455f3d:'
		+ '70b6a18de851f0e530d562d544bf60f0:'
		+ '17798b8c1e14e7e1fff849f217c0bac3293d';

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
								created_at: new Date('2022-10-15T00:00:00.00Z')
							}
						})
					}
				}
			};

			loginStub.returns(Promise.resolve(twitterLoginResponse));

			// Act:
			const result = await twitter.userAccess({
				oauthToken: 'token',
				oauthTokenSecret: validOauthTokenSecret,
				oauthVerifier: 'verifier'
			});

			// Assert:
			const { iat, ...payload } = decode(result);
			expect(loginStub).to.have.been.calledWith('verifier');
			expect(payload).to.be.deep.equal({
				accessSecret: 'secret1234',
				accessToken: 'token1234',
				screenName: 'twitterAccount',
				followersCount: 3,
				createdAt: '2022-10-15T00:00:00.000Z'
			});
		});

		it('throws error when request token fail', async () => {
			// Arrange:
			loginStub.throws();

			// Act:
			const promise = twitter.userAccess({
				oauthToken: 'token',
				oauthTokenSecret: validOauthTokenSecret,
				oauthVerifier: 'verifier'
			});

			// Assert:
			await expect(promise).to.be.rejectedWith('fail to request user access token');
		});

		it('throws error when encryptedOauthTokenSecret invalid', async () => {
			// Arrange + Act:
			const promise = twitter.userAccess({
				oauthToken: 'token',
				oauthTokenSecret: 'invalid hex',
				oauthVerifier: 'verifier'
			});

			// Assert:
			await expect(promise).to.be.rejectedWith('fail to request user access token');
		});
	});
});
