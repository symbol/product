import { BLOCK_STATUS } from '@/app/constants';
import { getBlockStatus } from '@/app/variants/symbol/utils/blocks';

describe('variants/symbol/utils/blocks', () => {
	it('uses the block row finality value', () => {
		// Act + Assert:
		expect(getBlockStatus({ height: 100, isFinalized: true }, { finalizedHeight: 1 })).toBe(BLOCK_STATUS.FINALIZED);
		expect(getBlockStatus({ height: 100, isFinalized: false }, { finalizedHeight: 1000 })).toBe(BLOCK_STATUS.CREATED);
	});

	it('does not treat missing or null finality as finalized', () => {
		// Act + Assert:
		expect(getBlockStatus({ height: 100 })).toBe(BLOCK_STATUS.CREATED);
		expect(getBlockStatus({ height: 100, isFinalized: null })).toBe(BLOCK_STATUS.CREATED);
	});
});
