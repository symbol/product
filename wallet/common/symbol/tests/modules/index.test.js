import { expect, jest } from '@jest/globals';

const mockShuffle = jest.fn(arr => arr);
jest.unstable_mockModule('lodash', () => ({
	shuffle: mockShuffle,
	default: { shuffle: mockShuffle }
}));

const { TransferModule, HarvestingModule, TokenModule } = await import('../../src/modules');

describe('modules/index.js re-exports', () => {
	it('re-exports TransferModule, HarvestingModule and TokenModule', () => {
		// Assert:
		expect(typeof TransferModule).toBe('function');
		expect(typeof HarvestingModule).toBe('function');
		expect(typeof TokenModule).toBe('function');

		// Instances can be created without args and then initialized
		const transfer = new TransferModule();
		const harvesting = new HarvestingModule();
		const token = new TokenModule();

		expect(transfer).toBeInstanceOf(TransferModule);
		expect(harvesting).toBeInstanceOf(HarvestingModule);
		expect(token).toBeInstanceOf(TokenModule);
	});
});
