import { TransferModule } from '../../src/modules';
import { expect } from '@jest/globals';

describe('modules/index.js re-exports', () => {
	it('re-exports TransferModule and HarvestingModule', () => {
		// Assert:
		expect(typeof TransferModule).toBe('function');

		// Instances can be created without args and then initialized
		const transfer = new TransferModule();

		expect(transfer).toBeInstanceOf(TransferModule);
	});
});
