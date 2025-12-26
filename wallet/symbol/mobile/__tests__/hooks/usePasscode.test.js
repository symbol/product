import { usePasscode } from '@/app/hooks/usePasscode';
import { act, renderHook } from '@testing-library/react-native';

describe('hooks/usePasscode', () => {
	describe('initial state', () => {
		const runInitialStateTest = (config, expected) => {
			it(`initializes with type "${config.type}" and isVisible "${expected.isVisible}"`, () => {
				// Arrange:
				const onSuccess = jest.fn();

				// Act:
				const { result } = renderHook(() => usePasscode({ onSuccess }, config.type));
				const { props } = result.current;

				// Assert:
				expect(props.isVisible).toBe(expected.isVisible);
				expect(props.type).toBe(expected.type);
			});
		};

		const tests = [
			{ type: 'verify', expected: { isVisible: false, type: 'verify' } },
			{ type: 'create', expected: { isVisible: false, type: 'create' } },
			{ type: undefined, expected: { isVisible: false, type: 'verify' } }
		];

		tests.forEach(test => {
			runInitialStateTest({ type: test.type }, test.expected);
		});
	});

	describe('show function', () => {
		it('sets isVisible to true when show is called', () => {
			// Arrange:
			const onSuccess = jest.fn();
			const { result } = renderHook(() => usePasscode({ onSuccess }));

			// Act:
			act(() => {
				result.current.show();
			});

			// Assert:
			expect(result.current.props.isVisible).toBe(true);
		});
	});

	describe('props.onSuccess', () => {
		it('sets isVisible to false and calls onSuccess callback', () => {
			// Arrange:
			const onSuccess = jest.fn();
			const { result } = renderHook(() => usePasscode({ onSuccess }));

			act(() => {
				result.current.show();
			});
			expect(result.current.props.isVisible).toBe(true);

			// Act:
			act(() => {
				result.current.props.onSuccess();
			});

			// Assert:
			expect(result.current.props.isVisible).toBe(false);
			expect(onSuccess).toHaveBeenCalledTimes(1);
		});
	});

	describe('props.onCancel', () => {
		it('sets isVisible to false and calls onCancel callback when provided', () => {
			// Arrange:
			const onSuccess = jest.fn();
			const onCancel = jest.fn();
			const { result } = renderHook(() => usePasscode({ onSuccess, onCancel }));

			act(() => {
				result.current.show();
			});
			expect(result.current.props.isVisible).toBe(true);

			// Act:
			act(() => {
				result.current.props.onCancel();
			});

			// Assert:
			expect(result.current.props.isVisible).toBe(false);
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it('sets isVisible to false without error when onCancel callback is not provided', () => {
			// Arrange:
			const onSuccess = jest.fn();
			const { result } = renderHook(() => usePasscode({ onSuccess }));

			act(() => {
				result.current.show();
			});
			expect(result.current.props.isVisible).toBe(true);

			// Act:
			act(() => {
				result.current.props.onCancel();
			});

			// Assert:
			expect(result.current.props.isVisible).toBe(false);
		});
	});
});
