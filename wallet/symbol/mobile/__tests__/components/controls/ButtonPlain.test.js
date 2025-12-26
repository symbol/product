import { ButtonPlain } from '@/app/components/controls/ButtonPlain';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';

describe('components/ButtonPlain', () => {
	const createDefaultProps = () => ({
		text: 'Test Button',
		onPress: jest.fn()
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	runRenderTextTest(ButtonPlain, {
		props: createDefaultProps(),
		textToRender: [{ type: 'text', value: 'Test Button' }]
	});

	runPressTest(ButtonPlain, {
		props: createDefaultProps(),
		textToPress: 'Test Button',
		testDisabledState: true
	});
});
