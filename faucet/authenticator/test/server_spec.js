const twitterController = require('../src/controllers');
const server = require('../src/server');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const supertest = require('supertest');

describe('Server', () => {
	const assertGetErrorCode500 = async (functionStub, endpoint) => {
		// Arrange:
		functionStub.throws();

		// Act:
		const response = await supertest(server)
			.get(endpoint)
			.set('Accept', 'application/json');

		// Assert:
		expect(response.status).to.be.equal(500);
	};

	describe('GET /twitter/auth', () => {
		let requestTokenStub = {};

		beforeEach(() => {
			requestTokenStub = stub(twitterController, 'requestToken');
		});

		afterEach(restore);

		it('responds 200', async () => {
			// Arrange:
			requestTokenStub.returns(Promise.resolve({
				oauthTokenSecret: 'token secret',
				url: 'http://localhost'
			}));

			// Act:
			const response = await supertest(server)
				.get('/twitter/auth')
				.set('Accept', 'application/json');

			// Assert:
			expect(response.status).to.be.equal(200);
			expect(response.body).to.be.deep.equal({
				oauthTokenSecret: 'token secret',
				url: 'http://localhost'
			});
		});

		it('responds 500 when request token failure', () => assertGetErrorCode500(requestTokenStub, '/twitter/auth'));
	});

	describe('GET /twitter/verify', () => {
		let userAccessStub = {};

		beforeEach(() => {
			userAccessStub = stub(twitterController, 'userAccess');
		});

		afterEach(restore);

		it('responds 200', async () => {
			// Arrange:
			const userInfo = {
				accessSecret: 'secret1234',
				accessToken: 'token1234',
				screenName: 'twitterAccount',
				followersCount: 3,
				createdAt: '12345'
			};

			userAccessStub.returns(Promise.resolve(userInfo));

			// Act:
			const response = await supertest(server)
				.get('/twitter/verify?oauthToken=token&oauthTokenSecret=secret&oauthVerifier=verifier')
				.set('Accept', 'application/json');

			// Assert:
			expect(userAccessStub).to.have.been.calledWith({
				oauthToken: 'token',
				oauthTokenSecret: 'secret',
				oauthVerifier: 'verifier'
			});
			expect(response.status).to.be.equal(200);
			expect(response.body).to.be.deep.equal(userInfo);
		});

		it('responds 500 request user access failure', () => assertGetErrorCode500(
			userAccessStub,
			'/twitter/verify?oauthToken=token&oauthTokenSecret=secret&oauthVerifier=verifier'
		));
	});
});
