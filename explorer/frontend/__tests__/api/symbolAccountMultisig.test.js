import * as utils from '@/utils/server';
import { fetchAccountMultisig } from '@/variants/symbol/api/accountMultisig';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/accountMultisig', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('fetches and formats account multisig information', async () => {
		// Arrange:
		const response = {
			multisig: {
				minApproval: 2,
				minRemoval: 1,
				cosignatoryAddresses: [
					'980FE0526FA6F38999A3B4CF35A928A4391D4620634A025A',
					'TCOSIGNATORYADDRESS2V7NJ27SYNA7WILGVQ'
				],
				multisigAddresses: [
					'TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2'
				]
			}
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchAccountMultisig('TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ');

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/account/TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ/multisig');
		expect(result).toEqual({
			minApproval: 2,
			minRemoval: 1,
			cosignatoryAddresses: [
				'TAH6AUTPU3ZYTGNDWTHTLKJIUQ4R2RRAMNFAEWQ',
				'TCOSIGNATORYADDRESS2V7NJ27SYNA7WILGVQ'
			],
			multisigAddresses: [
				'TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2'
			]
		});
	});

	it('omits min approval and min removal when account has no cosignatories', async () => {
		// Arrange:
		const response = {
			multisig: {
				minApproval: 0,
				minRemoval: 0,
				cosignatoryAddresses: [],
				multisigAddresses: ['TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2']
			}
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(response);

		// Act:
		const result = await fetchAccountMultisig('TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ');

		// Assert:
		expect(result).toEqual({
			minApproval: null,
			minRemoval: null,
			cosignatoryAddresses: [],
			multisigAddresses: ['TMULTISIGACCOUNTQZ7OWKIIP5GPMLPQV7NJ2']
		});
	});
});
