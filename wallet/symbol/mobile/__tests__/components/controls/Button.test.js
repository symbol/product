import { Button } from '@/app/components/controls/Button';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';

describe('components/Button', () => {
	const createDefaultProps = () => ({
		text: 'Test Button',
		onPress: jest.fn()
	});

	runRenderTextTest(Button, {
		props: createDefaultProps(),
		textToRender: [{ type: 'text', value: 'Test Button' }]
	});

	runPressTest(Button, {
		props: createDefaultProps(),
		textToPress: 'Test Button',
		testDisabledState: true
	});
});
