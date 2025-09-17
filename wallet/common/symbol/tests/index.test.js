import { expect, jest } from '@jest/globals';

const mockShuffle = jest.fn(arr => arr);
jest.unstable_mockModule('lodash', () => ({
	shuffle: mockShuffle,
	default: { shuffle: mockShuffle }
}));

const entry = await import('../src');

describe('package entry (src/index.js)', () => {
	it('re-exports Api, sdk, and modules', () => {
		// Assert:
		expect(entry).toBeDefined();
		expect(typeof entry.Api).toBe('function');
		expect(entry.sdk).toBeDefined();
		expect(typeof entry.sdk.signTransaction).toBe('function');
		expect(typeof entry.sdk.cosignTransaction).toBe('function');
		expect(typeof entry.sdk.encryptMessage).toBe('function');
		expect(typeof entry.sdk.decryptMessage).toBe('function');
		expect(typeof entry.sdk.createPrivateAccount).toBe('function');
		expect(typeof entry.sdk.createPrivateKeysFromMnemonic).toBe('function');

		expect(typeof entry.TransferModule).toBe('function');
		expect(typeof entry.HarvestingModule).toBe('function');
	});
});
