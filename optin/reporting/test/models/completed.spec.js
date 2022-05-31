const Config = require('../../config');
const completedDB = require('../../models/completed');
const { refreshDBs } = require('../../models/database');
const runDBNotFoundTests = require('../test/runDBNotFoundTests');
const runTotalRecordTests = require('../test/runTotalRecordTests');
const { expect } = require('chai');
const { stub, restore } = require('sinon');
const path = require('path');

const mockCompletedRecordQuery = {
	basic: [
		{
			id: 26453,
			isPostoptin: 1,
			nemSource: [{
				address: '680B140819D8B6C734091637DA4B3B854BC2FD30D3FE42B0BA',
				balance: 3007282359130,
				hashes: '24C4DB714FB339905939D76665B3BB18AB0031938130C58546B8B0595593DDD8',
				height: '3691432',
				label: null,
				timestamps: '1650982163'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3007282359130,
				hashes: 'D6E43A475D94C1338ED985E87EFE8FDB1FC498971FCB57A5DBEAB65EABE641B2',
				height: 1170178,
				timestamps: 1651073772.624
			}],
			nemTimestamp: 1650982163,
			symbolTimestamp: 1651073772.624
		},
		{
			id: 26452,
			isPostoptin: 1,
			nemSource: [{
				address: '688283016813AC29EE88053EFC62C8047773B7C085FC15AA51',
				balance: 3001882177821,
				hashes: 'E4AEE3D3D9507CC8818704D917C40F1FDBDD9E6FE84C143F5995C15DCAD4552F',
				height: '3691446',
				label: null,
				timestamps: '1650983000'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3001882177821,
				hashes: '6FF710C69168F7A14BCDE8735D210BA8BEEACDEEA118DF75BBD523BE0467D568',
				height: 1170176,
				timestamps: 1651073693.869
			}],
			nemTimestamp: 1650983000,
			symbolTimestamp: 1651073693.869
		},
		{
			id: 26451,
			isPostoptin: 1,
			nemSource: [{
				address: '6816811340FEC6BC4DFCDFBA6694548828FDDEA12BBF86E1D6',
				balance: 3009039776345,
				hashes: '03449973A061DB0B8D0207DBAF5301627A3E3ACB12BA4A9AC537CCC7C4B4CD62',
				height: '3691452',
				label: null,
				timestamps: '1650983297'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3009039776345,
				hashes: '3995638B39667AB54E2F47E20417E6A076497B3C169F4D7660D7C19130FD8A7C',
				height: 1170174,
				timestamps: 1651073665.015
			}],
			nemTimestamp: 1650983297,
			symbolTimestamp: 1651073665.015
		},
		{
			id: 26450,
			isPostoptin: 1,
			nemSource: [{
				address: '6816811369BEDBFD1F3B4387713B47B411694C4F174B535BE8',
				balance: 3008838713888,
				hashes: 'CB5D980223A486CCA5C780C7E16A248052CF4DB7DC0D328D1E726CBBD30022E1',
				height: '3691455',
				label: null,
				timestamps: '1650983483'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3008838713888,
				hashes: 'B678D7CC8B438EB6D57EE36583006C3D844E844D031137B608E9A970E3A6DA9A',
				height: 1170173,
				timestamps: 1651073627.465
			}],
			nemTimestamp: 1650983483,
			symbolTimestamp: 1651073627.465
		},
		{
			id: 26449,
			isPostoptin: 1,
			nemSource: [{
				address: '6816811396FACFE59582E9AE1DD5F5B209180DC24B48C373F4',
				balance: 3008612385925,
				hashes: 'F988C9EAE8BAA566B8273D934F55C5626281314588858994C3E8C160E2541918',
				height: '3691462',
				label: null,
				timestamps: '1650983664'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3008612385925,
				hashes: '20B7B0AC70414D83F5B73637955216017BF8BF00D826638E6AFC595EBFFF605A',
				height: 1170172,
				timestamps: 1651073592.295
			}],
			nemTimestamp: 1650983664,
			symbolTimestamp: 1651073592.295
		}],
	postOptin: [
		{
			id: 26453,
			isPostoptin: 1,
			nemSource: [{
				address: '680B140819D8B6C734091637DA4B3B854BC2FD30D3FE42B0BA',
				balance: 3007282359130,
				hashes: '24C4DB714FB339905939D76665B3BB18AB0031938130C58546B8B0595593DDD8',
				height: '3691432',
				label: null,
				timestamps: '1650982163'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3007282359130,
				hashes: 'D6E43A475D94C1338ED985E87EFE8FDB1FC498971FCB57A5DBEAB65EABE641B2',
				height: 1170178,
				timestamps: 1651073772.624
			}],
			nemTimestamp: 1650982163,
			symbolTimestamp: 1651073772.624
		},
		{
			id: 26452,
			isPostoptin: 1,
			nemSource: [{
				address: '688283016813AC29EE88053EFC62C8047773B7C085FC15AA51',
				balance: 3001882177821,
				hashes: 'E4AEE3D3D9507CC8818704D917C40F1FDBDD9E6FE84C143F5995C15DCAD4552F',
				height: '3691446',
				label: null,
				timestamps: '1650983000'
			}],
			symbolDestination: [{
				address: '6854E15A45E973283640A12F90001251695C2295F496871F',
				balance: 3001882177821,
				hashes: '6FF710C69168F7A14BCDE8735D210BA8BEEACDEEA118DF75BBD523BE0467D568',
				height: 1170176,
				timestamps: 1651073693.869
			}],
			nemTimestamp: 1650983000,
			symbolTimestamp: 1651073693.869
		}],
	preOptin: [
		{
			id: 10,
			isPostoptin: 0,
			nemSource: [{
				address: '68CBD6C5EF2B90A8167F5BCE2EBC495E755677916DEFEBC07E',
				balance: 85657468724502,
				hashes: '68FB3841FC1DFE77730A46DB4DB4E70B0EBC01ADF0096CA509E94E0A7EE56730',
				height: '3092748',
				label: null,
				timestamps: '1614752283'
			}],
			symbolDestination: [{
				address: '68C364EF9573688F382BFEE13AA4DF68FB755CB02F11A08B',
				balance: 85657468724502,
				hashes: 'E253A257515F657BC691C58C03A5CB4E8925A2AB13697BDAF30D1B09774FB7B8',
				height: 1,
				timestamps: 1615853185
			}],
			nemTimestamp: 1614752283,
			symbolTimestamp: 1615853185
		},
		{
			id: 9,
			isPostoptin: 0,
			nemSource: [{
				address: '68DE1E69EBF64ACDFEF5652E3B07AEBB211E75222CA334034D',
				balance: 95300024600000,
				hashes: '7E6CFC93B71E38F11B507777864F8EDF77753A5109036F321923D5C31CB4773B',
				height: '2992634',
				label: 'Bitflyer',
				timestamps: '1608694362'
			}],
			symbolDestination: [{
				address: '6852D1DC6A57187644B3B8AD4806CE226B6E1B2D8A133D8B',
				balance: 95300024600000,
				hashes: '4326E2C3B2DDE7270D3E09479A3631EBC12E988B0310FE02E8D37377A6796FFA',
				height: 1,
				timestamps: 1615853185
			}],
			nemTimestamp: 1608694362,
			symbolTimestamp: 1615853185
		}]
};

const runBasicOptinTypeTests = (types, parameters) => {
	/* eslint-disable no-await-in-loop */
	for (let i = 0; i <= types.length - 1; ++i) {
		// Arrange:
		const { optinType, expectedResult } = types[i];

		it(`returns ${0 === optinType ? 'pre' : 'post'}-optin records`, async () => {
			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				pageSize: 2,
				optinType
			});

			// Assert:
			expect(result).to.deep.equal(expectedResult);
		});
	}
};

describe('completed models', () => {
	const parameters = {
		nemAddressHex: null,
		optinType: null,
		pageNumber: 1,
		pageSize: 10,
		sortBy: '',
		sortDirection: '',
		symbolAddressHex: null,
		txHash: null
	};

	beforeEach(() => {
		stub(Config, 'getDataStoragePath').returns(path.join(__dirname, '../resources'));
		refreshDBs();
	});

	afterEach(restore);

	describe('verify if database exists', () => {
		runDBNotFoundTests({
			paginationFunc: completedDB.getCompletedPagination,
			parameters
		});
	});

	describe('getCompletedPagination', () => {
		describe('optin type', () => {
			runBasicOptinTypeTests([{
				optinType: 0,
				expectedResult: mockCompletedRecordQuery.preOptin
			}, {
				optinType: 1,
				expectedResult: mockCompletedRecordQuery.postOptin
			}], parameters);
		});

		it('returns basic records', async () => {
			// Arrange + Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				pageSize: 5
			});

			// Assert:
			expect(result).to.deep.equal(mockCompletedRecordQuery.basic);
		});

		it('returns sorted id in descending given invalid sortBy', async () => {
			// Arrange:
			const sort = {
				sortBy: 'invalid',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.id - a.id);

			result.forEach((item, index) => {
				expect(item.id).to.be.equal(sortedResult[index].id);
			});
		});

		it('returns sorted nem timestamp records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'nemHashes',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.nemSource[0].timestamps - a.nemSource[0].timestamps);

			result.forEach((item, index) => {
				expect(item.nemSource[0].timestamps).to.be.equal(sortedResult[index].nemSource[0].timestamps);
			});
		});

		it('returns sorted symbol timestamp records in descending', async () => {
			// Arrange:
			const sort = {
				sortBy: 'symbolHashes',
				sortDirection: 'DESC'
			};

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				...sort
			});

			// Assert:
			const sortedResult = [...result].sort((a, b) => b.symbolDestination[0].timestamps - a.symbolDestination[0].timestamps);

			result.forEach((item, index) => {
				expect(item.symbolDestination[0].timestamps).to.be.equal(sortedResult[index].symbolDestination[0].timestamps);
			});
		});

		it('returns search result provided nem address', async () => {
			// Arrange:
			const nemAddressHex = '680B140819D8B6C734091637DA4B3B854BC2FD30D3FE42B0BA';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				nemAddressHex
			});

			// Assert:
			expect(result[0].nemSource.length).to.be.equal(1);
			expect(result[0].nemSource[0].address).to.be.equal(nemAddressHex);
		});

		it('returns search result provided symbol address', async () => {
			// Arrange:
			const symbolAddressHex = '6854E15A45E973283640A12F90001251695C2295F496871F';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				symbolAddressHex
			});

			// Assert:
			expect(result[0].symbolDestination.length).to.be.equal(1);
			expect(result[0].symbolDestination[0].address).to.be.equal(symbolAddressHex);
		});

		it('returns search result provided transaction hash', async () => {
			// Arrange:
			const txHash = 'D6E43A475D94C1338ED985E87EFE8FDB1FC498971FCB57A5DBEAB65EABE641B2';

			// Act:
			const result = await completedDB.getCompletedPagination({
				...parameters,
				txHash
			});

			// Assert:
			expect(result[0].symbolDestination.length).to.be.equal(1);
			expect(result[0].symbolDestination[0].hashes).to.be.equal(txHash);
		});
	});

	describe('getTotalRecord', () => {
		runTotalRecordTests({
			database: completedDB,
			parameters: {
				nemAddressHex: null,
				optinType: null,
				symbolAddressHex: null,
				txHash: null
			},
			expectedResult: 20
		});
	});
});
