const manageStateSnapRequest = async (operation, newState) => {
	try {
		return await snap.request({
			method: 'snap_manageState',
			params: {
				operation,
				newState
			}
		});
	} catch (error) {
		throw new Error('Error in manageStateSnapRequest:', error);
	}
};

const stateManager = {
	async update(state) {
		await manageStateSnapRequest('update', state);
	},
	async getState() {
		const state = await manageStateSnapRequest('get');
		return state;
	},
	async clear() {
		await manageStateSnapRequest('clear');
	}
};

export default stateManager;
