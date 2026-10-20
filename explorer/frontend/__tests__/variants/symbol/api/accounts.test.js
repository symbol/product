import config from '@/app/config';
import { formatAccountCSV } from '@/app/utils/common';
import * as serverUtils from '@/app/utils/server';
import {
	fetchAccountHarvestedBlockPage,
	fetchAccountInfo,
	fetchAccountInfoByPublicKey,
	fetchAccountPage
} from '@/app/variants/symbol/api/accounts';
import { stubAccounts, stubHarvestedBlocks } from '@/app/variants/symbol/api/fixtures';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const SYMBOL_API_BASE_URL = 'https://explorer.backend/api/symbol';
const EXPECTED_ACCOUNT = {
	address: 'TACCOUNTADDRESS',
	publicKey: null,
	accountType: 'main',
	importance: 0.09765625,
	balance: 0,
	namespaces: [],
	mosaics: [],
	description: null,
	isHarvestingActive: false,
	isMultisig: false
};

beforeEach(() => {
	config.PUBLIC_API_BASE_URL = SYMBOL_API_BASE_URL;
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('variants/symbol/api/accounts', () => {
	describe('fetchAccountPage', () => {
		it('requests the first page and maps Symbol account list values', async () => {
			// Arrange:
			const account = {
				address: 'TACCOUNTADDRESS',
				publicKey: null,
				accountType: 'main',
				importance: 0.0009765625,
				balance: 0,
				namespaces: [],
				mosaics: [],
				description: null,
				isHarvestingActive: false,
				isMultisig: false
			};
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([account]);

			// Act:
			const result = await fetchAccountPage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0`);
			expect(result).toEqual({ data: [EXPECTED_ACCOUNT], pageNumber: 1 });
		});

		it.each([
			['omitted fields', {}, 'limit=10&offset=0', 1],
			['numeric values', { pageNumber: 2, pageSize: 25, isLatest: false, isActiveHarvesting: false }, 'limit=25&offset=25', 2],
			['undefined fields', { pageNumber: undefined, pageSize: undefined }, 'limit=10&offset=0', 1],
			['undefined page number', { pageNumber: undefined, pageSize: 25 }, 'limit=25&offset=0', 1],
			['undefined page size', { pageNumber: 2, pageSize: undefined }, 'limit=10&offset=10', 2],
			['decimal strings', { pageNumber: '3', pageSize: '25' }, 'limit=25&offset=50', 3],
			['leading zero strings', { pageNumber: '003', pageSize: '025' }, 'limit=25&offset=50', 3],
			['minimum page size', { pageNumber: 2, pageSize: 1 }, 'limit=1&offset=1', 2],
			['maximum page size', { pageNumber: 2, pageSize: 100 }, 'limit=100&offset=100', 2],
			['maximum offset', { pageNumber: 1001, pageSize: 100 }, 'limit=100&offset=100000', 1001]
		])('accepts pagination with %s', async (_description, searchParams, expectedQuery, expectedPageNumber) => {
			// Arrange:
			const expectedInput = { ...searchParams };
			Object.freeze(searchParams);
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			const result = await fetchAccountPage(searchParams);

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${SYMBOL_API_BASE_URL}/accounts?${expectedQuery}`);
			expect(result).toEqual({ data: [], pageNumber: expectedPageNumber });
			expect(searchParams).toEqual(expectedInput);
		});

		describe.each(['pageNumber', 'pageSize'])('%s input validation', parameter => {
			it.each([
				['null', null],
				['true', true],
				['false', false],
				['an empty array', []],
				['an array containing an integer', [2]],
				['an object', {}],
				['an empty string', ''],
				['whitespace', ' '],
				['leading whitespace', ' 2'],
				['trailing whitespace', '2 '],
				['a trailing newline', '2\n'],
				['non-numeric text', 'oops'],
				['a fractional number', 1.9],
				['a fractional string', '1.9'],
				['exponent notation', '1e3'],
				['trailing text', '2items'],
				['a plus sign', '+2'],
				['hexadecimal notation', '0x10'],
				['non-ASCII digits', '２'],
				['NaN', NaN],
				['infinity', Infinity],
				['an unsafe integer', Number.MAX_SAFE_INTEGER + 1],
				['an unsafe integer string', '9007199254740992']
			])('rejects %s before making an HTTP request', async (_description, value) => {
				// Arrange:
				const searchParams = Object.freeze({ [parameter]: value });
				const expectedInput = { [parameter]: value };
				const expectedError = `${parameter} must be a safe integer or decimal digit string`;
				const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

				// Act + Assert:
				await expect(fetchAccountPage(searchParams)).rejects.toThrow(expectedError);
				expect(makeRequest).not.toHaveBeenCalled();
				expect(searchParams).toEqual(expectedInput);
			});
		});

		it('maps latest and active harvesting filters to Symbol REST parameters', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchAccountPage({ isLatest: true, isActiveHarvesting: true });

			// Assert:
			const expectedURL = `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=HEIGHT&is_harvesting=true`;
			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
		});

		it.each([
			['isLatest', { isLatest: false }],
			['isActiveHarvesting', { isActiveHarvesting: false }]
		])('clears the %s filter when false', async (_name, searchParams) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchAccountPage(searchParams);

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0`);
		});

		it('requests BALANCE sorting with the supplied mosaic ID and preserves the returned balance', async () => {
			// Arrange:
			const account = {
				address: 'THOLDERADDRESS',
				publicKey: 'AB'.repeat(32),
				accountType: 'main',
				importance: 0,
				balance: 12.345678,
				namespaces: ['holder.namespace'],
				mosaics: [{ id: 'ABCDEF0123456789', name: 'holder.namespace', amount: 12.345678, isCreatedByAccount: false }],
				description: 'holder',
				isHarvestingActive: true,
				isMultisig: true
			};
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([account]);

			// Act:
			const result = await fetchAccountPage({ mosaic: 'ABCDEF0123456789' });

			// Assert:
			const expectedURL = `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=BALANCE&mosaic_id=ABCDEF0123456789`;
			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
			expect(result.data[0]).toEqual({
				...account,
				importance: 0
			});
		});

		it('preserves multiple DTO rows in response order and converts only importance', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([
				{
					address: 'TZACCOUNTADDRESS',
					publicKey: null,
					accountType: 'main',
					importance: 0.0009765625,
					balance: '9007199254740993.123456',
					namespaces: ['z.namespace', 'a.namespace'],
					mosaics: [{ id: '0000000000000001', name: null, amount: '9007199254740993.000001', isCreatedByAccount: false }],
					description: null,
					isHarvestingActive: false,
					isMultisig: true
				},
				{
					address: 'TAACCOUNTADDRESS',
					publicKey: '0000000000000000000000000000000000000000000000000000000000000001',
					accountType: 'remote',
					importance: 0.0000000001,
					balance: 0,
					namespaces: ['other.namespace'],
					mosaics: [{ id: 'ABCDEF0123456789', name: 'other.namespace', amount: 12.345678, isCreatedByAccount: true }],
					description: 'another account',
					isHarvestingActive: true,
					isMultisig: false
				}
			]);

			// Act:
			const result = await fetchAccountPage();

			// Assert:
			expect(result).toEqual({
				data: [
					{
						address: 'TZACCOUNTADDRESS',
						publicKey: null,
						accountType: 'main',
						importance: 0.09765625,
						balance: '9007199254740993.123456',
						namespaces: ['z.namespace', 'a.namespace'],
						mosaics: [{ id: '0000000000000001', name: null, amount: '9007199254740993.000001', isCreatedByAccount: false }],
						description: null,
						isHarvestingActive: false,
						isMultisig: true
					},
					{
						address: 'TAACCOUNTADDRESS',
						publicKey: '0000000000000000000000000000000000000000000000000000000000000001',
						accountType: 'remote',
						importance: 0.00000001,
						balance: 0,
						namespaces: ['other.namespace'],
						mosaics: [{ id: 'ABCDEF0123456789', name: 'other.namespace', amount: 12.345678, isCreatedByAccount: true }],
						description: 'another account',
						isHarvestingActive: true,
						isMultisig: false
					}
				],
				pageNumber: 1
			});
			expect(makeRequest).toHaveBeenCalledWith(`${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0`);
		});

		it('normalizes supported explicit REST search parameters', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchAccountPage({ sort_field: 'importance', sort_order: 'desc', is_harvesting: 'FALSE' });

			// Assert:
			const expectedURL =
				`${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=IMPORTANCE&sort_order=DESC&is_harvesting=false`;
			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
		});

		it('accepts explicit BALANCE sorting with a REST mosaic_id', async () => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

			// Act:
			await fetchAccountPage({ sort_field: 'BALANCE', mosaic_id: 'ABCDEF0123456789' });

			// Assert:
			const expectedURL = `${SYMBOL_API_BASE_URL}/accounts?limit=10&offset=0&sort_field=BALANCE&mosaic_id=ABCDEF0123456789`;
			expect(makeRequest).toHaveBeenCalledWith(expectedURL);
		});

		it.each([
			['unknown search parameter', { unknownFilter: true }, /Unsupported Symbol account search parameter/],
			['non-boolean latest filter', { isLatest: 'true' }, /isLatest must be a boolean/],
			['non-boolean harvesting filter', { isActiveHarvesting: 1 }, /isActiveHarvesting must be a boolean/],
			['unsupported sort field', { sort_field: 'NAME' }, /sort_field must be/],
			['unsupported sort order', { sort_order: 'ASC' }, /sort_order must be DESC/],
			['non-hex mosaic ID', { mosaic: 'symbol.xym' }, /16-character hexadecimal/],
			['REST mosaic ID without BALANCE sorting', { mosaic_id: 'ABCDEF0123456789' }, /mosaic_id requires BALANCE sorting/],
			['BALANCE sorting without a mosaic ID', { sort_field: 'BALANCE' }, /mosaic_id is required/],
			['mosaic with HEIGHT sorting', { sort_field: 'HEIGHT', mosaic: 'ABCDEF0123456789' }, /mosaic requires BALANCE/],
			['latest filter with IMPORTANCE sorting', { isLatest: true, sort_field: 'IMPORTANCE' }, /isLatest conflicts with sort_field/],
			['latest filter with mosaic sorting', { isLatest: true, mosaic: 'ABCDEF0123456789' }, /isLatest conflicts with mosaic/],
			['active harvesting with explicit false', { isActiveHarvesting: true, is_harvesting: false }, /isActiveHarvesting conflicts/],
			['both mosaic parameters', { mosaic: 'ABCDEF0123456789', mosaic_id: '0123456789ABCDEF' }, /cannot both be specified/]
		])('rejects %s before making an HTTP request', async (_description, searchParams, expectedError) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

			// Act + Assert:
			await expect(fetchAccountPage(searchParams)).rejects.toThrow(expectedError);
			expect(makeRequest).not.toHaveBeenCalled();
		});

		it.each([
			['zero page number', { pageNumber: 0 }, /pageNumber must be a positive integer/],
			['negative page number', { pageNumber: -1 }, /pageNumber must be a positive integer/],
			['zero page number string', { pageNumber: '0' }, /pageNumber must be a positive integer/],
			['zero page size', { pageSize: 0 }, /pageSize must be between 1 and 100/],
			['negative page size', { pageSize: -1 }, /pageSize must be between 1 and 100/],
			['page size string above 100', { pageSize: '101' }, /pageSize must be between 1 and 100/],
			['offset above 100000', { pageNumber: 100002, pageSize: 1 }, /offset must be between 0 and 100000/],
			['unsafe offset', { pageNumber: Number.MAX_SAFE_INTEGER, pageSize: 2 }, /offset must be between 0 and 100000/],
			['page size above 100', { pageSize: 101 }, /pageSize must be between 1 and 100/],
			['offset above 100000 with size 10', { pageNumber: 10002, pageSize: 10 }, /offset must be between 0 and 100000/]
		])('rejects %s before making an HTTP request', async (_description, searchParams, expectedError) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

			// Act + Assert:
			await expect(fetchAccountPage(searchParams)).rejects.toThrow(expectedError);
			expect(makeRequest).not.toHaveBeenCalled();
		});

		it.each([
			['HTTP 400', { response: { status: 400, data: { status: 400 } } }],
			['HTTP 503', { response: { status: 503, data: { status: 503 } } }],
			['HTTP 500', { response: { status: 500, data: { status: 500 } } }],
			['a communication timeout', new Error('timeout')]
		])('propagates %s from Explorer REST', async (_description, error) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchAccountPage()).rejects.toBe(error);
			expect(makeRequest).toHaveBeenCalledTimes(1);
		});

		it('keeps the account list row compatible with CSV output', async () => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([{
				address: 'TACCOUNTADDRESS',
				publicKey: null,
				accountType: 'main',
				importance: 0.0009765625,
				balance: 0,
				namespaces: [],
				mosaics: [],
				description: null,
				isHarvestingActive: false,
				isMultisig: false
			}]);

			// Act:
			const { data } = await fetchAccountPage();
			const csvRow = formatAccountCSV(data[0], key => key);

			// Assert:
			expect(csvRow).toEqual({
				table_field_address: 'TACCOUNTADDRESS',
				table_field_balance: 0,
				table_field_importance: 0.09765625,
				table_field_isMultisig: 'value_false',
				table_field_isHarvestingActive: 'value_false',
				table_field_description: null
			});
		});
	});

	describe('existing account functions', () => {
		it('returns the existing account info stub', async () => {
			// Arrange:
			const address = 'TACCOUNTADDRESS';

			// Act:
			const accountInfo = await fetchAccountInfo(address);

			// Assert:
			expect(accountInfo).toBe(stubAccounts[0]);
		});

		it('returns the existing public-key lookup stub', async () => {
			// Arrange:
			const publicKey = 'AB'.repeat(32);

			// Act:
			const accountInfo = await fetchAccountInfoByPublicKey(publicKey);

			// Assert:
			expect(accountInfo).toBe(stubAccounts[0]);
		});

		it('returns the first harvested-block stub page by default', async () => {
			// Arrange:
			const expectedPage = { data: stubHarvestedBlocks, pageNumber: 1 };

			// Act:
			const harvestedBlockPage = await fetchAccountHarvestedBlockPage();

			// Assert:
			expect(harvestedBlockPage).toEqual(expectedPage);
		});

		it('returns an empty subsequent harvested-block stub page', async () => {
			// Arrange:
			const searchParams = { pageNumber: 2 };

			// Act:
			const harvestedBlockPage = await fetchAccountHarvestedBlockPage(searchParams);

			// Assert:
			expect(harvestedBlockPage).toEqual({ data: [], pageNumber: 2 });
		});
	});
});
