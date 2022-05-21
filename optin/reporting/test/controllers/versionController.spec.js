const Config = require('../../config');
const VersionController = require('../../controllers/versionController');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub } = require('sinon');
const path = require('path');

describe('version controller', () => {
	describe('getVersion', () => {
		it('return version id and last update date time', async () => {
			// Arrange:
			const req = {};
			const res = TestUtils.mockResponse();

			stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../mock'));

			// Act:
			VersionController.getVersion(req, res);

			// Assert:
			const { versionId, lastUpdated } = res.json.getCall(0).firstArg;

			expect(versionId).to.be.equal('_ykRdiKlyoCZJAi4FPnptUcNL5FeNW9G');
			expect(lastUpdated).to.be.equal('Tue, 10 May 2022 13:59:22 GMT');
		});
	});
});
