const stateManager = {
	async manageStateSnapRequest(operation, newState) {
		return snap.request({
			method: 'snap_manageState',
			params: {
				operation,
				newState
			}
		});
	},
	async update(state) {
		await this.manageStateSnapRequest('update', state);
	},
	async getState() {
		const state = await this.manageStateSnapRequest('get');
		return state;
	},
	async clear() {
		await this.manageStateSnapRequest('clear');
	}
};

export default stateManager;
