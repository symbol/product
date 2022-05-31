const Config = require('../../config');
const VersionController = require('../../controllers/versionController');
const TestUtils = require('../TestUtils');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

describe('version controller', () => {
	afterEach(restore);

	const runBasicVersionTests = async ({ configPath, expectedResult }) => {
		// Arrange:
		const req = {};
		const res = TestUtils.mockResponse();

		stub(Config, 'getDataStoragePath').returns(path.join(__dirname, configPath));

		// Act:
		await VersionController.getVersion(req, res);

		// Assert:
		const result = res.json.getCall(0).firstArg;

		expect(result).to.be.deep.equal(expectedResult);
	};

	describe('getVersion', () => {
		it('return version id and last update date time', async () => {
			await runBasicVersionTests({
				configPath: '../resources',
				expectedResult: {
					versionId: '_ykRdiKlyoCZJAi4FPnptUcNL5FeNW9G',
					lastUpdated: 'Tue, 10 May 2022 13:59:22 GMT'
				}
			});
		});

		it('return version id and last update with empty value if file not found', async () => {
			await runBasicVersionTests({
				configPath: '../resources/not/found',
				expectedResult: {
					versionId: '',
					lastUpdated: ''
				}
			});
		});
	});
});
