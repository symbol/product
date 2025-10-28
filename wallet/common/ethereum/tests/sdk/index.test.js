import * as sdk from '../../src/sdk';
import { expect } from '@jest/globals';

describe('sdk/index.js re-exports', () => {
	it('exports signing, cosigning and message helpers', () => {
		// Assert:
		expect(typeof sdk.signTransaction).toBe('function');
		expect(typeof sdk.cosignTransaction).toBe('function');
		expect(typeof sdk.encryptMessage).toBe('function');
		expect(typeof sdk.decryptMessage).toBe('function');
		expect(typeof sdk.createPrivateAccount).toBe('function');
	});
});
