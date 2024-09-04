import { actionTypes, initialState, reducer } from './reducer';

describe('reducer', () => {
	describe('UPDATE_ACCOUNT', () => {
		// Arrange:
		const initialStateWithAccounts = {
			...initialState,
			accounts: {
				'1': { id: '1', label: 'Account 1' },
				'2': { id: '2', label: 'Account 2' }
			},
			selectedAccount: { id: '1', label: 'Account 1' }
		};

		it('should update the account and selectedAccount if the updated account is the currently selected account', () => {
			// Act:
			const action = {
				type: actionTypes.UPDATE_ACCOUNT,
				payload: { id: '1', label: 'Updated Account 1' }
			};

			const newState = reducer(initialStateWithAccounts, action);

			// Assert:
			expect(newState.accounts['1']).toBe(action.payload);
			expect(newState.selectedAccount).toBe(action.payload);
		});

		it('should update the account but not selectedAccount if the updated account is not the currently selected account', () => {
			// Act:
			const action = {
				type: actionTypes.UPDATE_ACCOUNT,
				payload: { id: '2', label: 'Updated Account 2' }
			};

			const newState = reducer(initialStateWithAccounts, action);

			// Assert:
			expect(newState.accounts['2']).toBe(action.payload);
			expect(newState.selectedAccount).toBe(initialStateWithAccounts.selectedAccount);
		});
	});

	describe('Default', () => {
		it('should return the initial state if the action is not recognized', () => {
			// Arrange:
			const action = {
				type: 'UNKNOWN_ACTION',
				payload: {}
			};

			// Act:
			const newState = reducer(initialState, action);

			// Assert:
			expect(newState).toBe(initialState);
		});
	});
});
