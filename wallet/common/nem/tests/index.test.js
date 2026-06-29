import * as entry from '../src';
import { expect } from '@jest/globals';

describe('package entry (src/index.js)', () => {
	it('re-exports the Api, the sdk namespace, constants, modules and utils', () => {
		// Assert: the Api aggregator and the curated sdk namespace.
		expect(typeof entry.Api).toBe('function');
		expect(typeof entry.sdk).toBe('object');
		expect(typeof entry.sdk.signTransaction).toBe('function');

		// Assert: the constants namespace.
		expect(typeof entry.constants).toBe('object');
		expect(typeof entry.constants.TransactionType).toBe('object');

		// Assert: a module re-export.
		expect(typeof entry.TransferModule).toBe('function');

		// Assert: a utils re-export.
		expect(typeof entry.calculateTransactionFee).toBe('function');
	});
});
