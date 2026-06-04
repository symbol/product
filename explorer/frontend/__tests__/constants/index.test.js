import { BACKEND_HEALTH_ERROR, TRANSACTION_TYPE } from '@/constants';

describe('constants', () => {
	it('exports Symbol alias transaction type names', () => {
		// Assert:
		expect(TRANSACTION_TYPE.MOSAIC_ALIAS).toBe('MOSAIC_ALIAS');
		expect(TRANSACTION_TYPE.MOSAIC_DEFINITION).toBe('MOSAIC_DEFINITION');
	});

	it('exports backend health error names', () => {
		// Assert:
		expect(BACKEND_HEALTH_ERROR.SYNCHRONIZATION).toBe('synchronization');
	});
});
