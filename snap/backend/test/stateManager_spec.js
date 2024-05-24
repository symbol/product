import stateManager from '../src/stateManager.js';
import { describe, jest } from '@jest/globals';

global.snap = {
	request: jest.fn()
};

describe('stateManager', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should update state', async () => {
		const mockState = { key: 'value' };
		await stateManager.update(mockState);
		expect(snap.request).toHaveBeenCalledWith({
			method: 'snap_manageState',
			params: {
				operation: 'update',
				newState: mockState
			}
		});
	});

	it('should get state', async () => {
		await stateManager.getState();
		expect(snap.request).toHaveBeenCalledWith({
			method: 'snap_manageState',
			params: {
				operation: 'get'
			}
		});
	});

	it('should clear state', async () => {
		await stateManager.clear();
		expect(snap.request).toHaveBeenCalledWith({
			method: 'snap_manageState',
			params: {
				operation: 'clear'
			}
		});
	});
});
