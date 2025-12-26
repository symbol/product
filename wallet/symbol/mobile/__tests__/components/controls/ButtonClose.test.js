import { ButtonClose } from '@/app/components/controls/ButtonClose';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';

describe('components/ButtonClose', () => {
	const createProps = () => ({
		onPress: jest.fn(),
		text: 'Test'
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	runRenderTextTest(ButtonClose, {
		props: createProps(),
		textToRender: [{ type: 'text', value: 'Test' }]
	});

	runPressTest(ButtonClose, {
		props: createProps(),
		textToPress: 'Test'
	});
});
