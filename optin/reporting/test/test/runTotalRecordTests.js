const { expect } = require('chai');

const runTotalRecordTests = ({ database, parameters, expectedResult }) => {
	it('returns total record', async () => {
		// Arrange + Act:
		const result = await database.getTotalRecord(parameters);

		// Assert:
		expect(result).to.be.equal(expectedResult);
	});
};

module.exports = runTotalRecordTests;
