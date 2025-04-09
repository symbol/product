import { SymbolURI } from '@/app/lib/features/SymbolURI';
import { networkProperties } from '__fixtures__/local/network';

const URI_ACTION = {
	Transaction: 'transaction'
};
const URI_SCHEME = 'web+symbol';

describe('SymbolURI', () => {
	describe('constructor', () => {
		describe('creates an instance for', () => {
			const runConstructorTest = (action, params) => {
				// Act:
				const symbolURI = new SymbolURI(action, params, networkProperties);

				// Assert:
				expect(symbolURI.params).toStrictEqual(params);
				expect(symbolURI.scheme).toBe(URI_SCHEME);
				expect(symbolURI.action).toBe(action);
			};

			it('Transaction', () => {
				// Arrange:
				const params = {
					data: 'some-transaction-payload',
					generationHash: networkProperties.generationHash
				};

				// Act & Assert:
				runConstructorTest(URI_ACTION.Transaction, params);
			});
		});

		describe('throws an error when', () => {
			const runConstructorErrorTest = (action, params, expectedErrorMessage) => {
				// Act & Assert:
				expect(() => new SymbolURI(action, params, networkProperties)).toThrow(expectedErrorMessage);
			};

			it('URI action is unsupported', () => {
				// Arrange:
				const action = 999;
				const params = { data: 'some-transaction-payload' };
				const expectedErrorMessage = `Unsupported Symbol URI action: "${action}"`;

				// Act & Assert:
				runConstructorErrorTest(action, params, expectedErrorMessage);
			});

			it('required parameter is missing', () => {
				// Arrange:
				const action = URI_ACTION.Transaction;
				const params = { data: 'some-transaction-payload' };
				const expectedErrorMessage = `Missing required parameter "generationHash" for action "${action}"`;

				// Act & Assert:
				runConstructorErrorTest(action, params, expectedErrorMessage);
			});

			it('unknown parameter is present', () => {
				// Arrange:
				const action = URI_ACTION.Transaction;
				const params = { data: 'some-transaction-payload', generationHash: networkProperties.generationHash, unknown: 'param' };
				const expectedErrorMessage = `Unknown parameter "unknown" for action "${action}"`;

				// Act & Assert:
				runConstructorErrorTest(action, params, expectedErrorMessage);
			});
		});
	});

	it('converts to transport string correctly', () => {
		// Arrange:
		const symbolURI = new SymbolURI(URI_ACTION.Transaction, {
			data: 'some-transaction-payload',
			generationHash: networkProperties.generationHash
		});
		// eslint-disable-next-line max-len
		const expectedResult = `${URI_SCHEME}://${URI_ACTION.Transaction}?data=some-transaction-payload&generationHash=${networkProperties.generationHash}`;

		// Act:
		const result = symbolURI.toTransportString();

		// Assert:
		expect(result).toBe(expectedResult);
	});

	it('converts to JSON correctly', () => {
		// Arrange:
		const symbolURI = new SymbolURI(URI_ACTION.Transaction, {
			data: 'some-transaction-payload',
			generationHash: networkProperties.generationHash
		});

		// Act:
		const result = symbolURI.toJSON();

		// Assert:
		expect(result).toStrictEqual({
			scheme: URI_SCHEME,
			action: URI_ACTION.Transaction,
			params: { data: 'some-transaction-payload', generationHash: networkProperties.generationHash }
		});
	});

	it('creates instance from transport string', () => {
		// Arrange:
		// eslint-disable-next-line max-len
		const transportString = `${URI_SCHEME}://${URI_ACTION.Transaction}?data=some-transaction-payload&generationHash=${networkProperties.generationHash}`;
		const expectedResult = new SymbolURI(
			URI_ACTION.Transaction, 
			{ data: 'some-transaction-payload', generationHash: networkProperties.generationHash }
		);

		// Act:
		const result = SymbolURI.fromTransportString(transportString, networkProperties);

		// Assert:
		expect(result).toStrictEqual(expectedResult);
	});
});
