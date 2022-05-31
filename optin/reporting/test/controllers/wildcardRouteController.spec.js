const wildcardRouteController = require('../../controllers/wildcardRouteController');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const fs = require('fs');

describe('wildcard route controller', () => {
	beforeEach(restore);

	const runBasicWildcardRouteTests = async ({ isIndexPageValid, expectedResult }) => {
		// Arrange:
		const req = {};
		const res = TestUtils.mockResponse();

		stub(fs, 'existsSync').returns(isIndexPageValid);

		// Act:
		await wildcardRouteController.routeHandler(req, res);

		// Assert:
		if (isIndexPageValid)
			expect(res.sendFile.getCall(0).firstArg).to.contain(expectedResult);
		else
			expect(res.status.getCall(0).firstArg).to.equal(expectedResult);
	};

	describe('routeHandler', () => {
		it('renders html content', async () => {
			await runBasicWildcardRouteTests({
				isIndexPageValid: true,
				expectedResult: 'client/build/index.html'
			});
		});

		it('renders errors when index html not found', async () => {
			await runBasicWildcardRouteTests({
				isIndexPageValid: false,
				expectedResult: 404
			});
		});
	});
});
