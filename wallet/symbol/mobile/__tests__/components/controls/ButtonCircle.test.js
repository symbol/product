import { ButtonCircle } from '@/app/components/controls/ButtonCircle';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';

describe('components/ButtonCircle', () => {
	const createDefaultProps = () => ({
		icon: 'account-add',
		onPress: jest.fn()
	});

	runRenderTextTest(ButtonCircle, {
		props: createDefaultProps(),
		textToRender: [{ type: 'label', value: 'account-add' }]
	});

	runPressTest(ButtonCircle, {
		props: createDefaultProps(),
		labelToPress: 'account-add',
		testDisabledState: true
	});
});
