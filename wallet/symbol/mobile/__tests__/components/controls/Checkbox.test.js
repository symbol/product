import { Checkbox } from '@/app/components/controls/Checkbox';
import { runRenderTextTest, runSwitchPressTest } from '__tests__/component-tests';

describe('components/Checkbox', () => {
	const createDefaultProps = ({ value, isDisabled } = {}) => ({
		text: 'Test',
		value: value ?? false,
		isDisabled: isDisabled ?? false,
		onPress: jest.fn()
	});

	runRenderTextTest(Checkbox, {
		props: createDefaultProps(),
		textToRender: [{ type: 'text', value: 'Test' }]
	});

	runSwitchPressTest(Checkbox, {
		props: createDefaultProps(),
		textToPress: 'Test',
		testDisabledState: true
	});
});
