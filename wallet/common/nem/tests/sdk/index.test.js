import * as sdk from '../../src/sdk';
import { expect } from '@jest/globals';

describe('sdk/index.js re-exports', () => {
	it('exports the signing, account and message helpers as functions', () => {
		// Arrange:
		const expectedFunctions = [
			'cosignTransaction',
			'createPrivateAccount',
			'createPrivateKeysFromMnemonic',
			'decryptMessage',
			'encryptMessage',
			'normalizeAddress',
			'normalizeTransactionHash',
			'signTransaction',
			'signTransactionBundle'
		];

		// Act & Assert:
		expectedFunctions.forEach(name => expect(typeof sdk[name]).toBe('function'));
	});
});
