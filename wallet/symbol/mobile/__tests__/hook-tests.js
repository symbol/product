import { renderHook } from '@testing-library/react-native';

/**
 * Runs contract tests for a given hook.
 * 
 * @param {Function} hook - The custom React hook to be tested.
 * @param {Object} options - The options for the contract test.
 * @param {Object} options.props - The props to be passed to the hook.
 * @param {Object} options.contract - The contract defining the expected fields and their types.
 * 
 * @example
 * runHookContractTest(useMyCustomHook, {
 *     props: { a: 1, b: 'test' },
 *     contract: {
 *         field1: 'string',
 *         field2: 'number',
 *         field3: 'function'
 *     }
 * });
 */
export const runHookContractTest = (hook, {
	props,
	contract
}) => {
	describe('contract', () => {
		it('returns all expected fields', async () => {
			// Act:
			const { result } = renderHook(() => hook(props));

			// Assert:
			Object.keys(contract).forEach(key => {
				expect(result.current).toHaveProperty(key);
				if (contract[key] === 'array')
					expect(Array.isArray(result.current[key])).toBe(true);
				else
					expect(typeof result.current[key]).toBe(contract[key]);
			});
		});

		it('does not return unexpected fields', async () => {
			// Act:
			const { result } = renderHook(() => hook(props));

			// Assert:
			Object.keys(result.current).forEach(key => {
				expect(contract).toHaveProperty(key);
			});
		});
	});
};
