import { TouchableNative } from '@/app/components/controls/TouchableNative';
import { runPressTest, runRenderTextTest } from '__tests__/component-tests';
import { Platform, Text } from 'react-native';

const PLATFORMS = ['android', 'ios'];

describe('components/TouchableNative', () => {
	const createProps = ({ color, colorPressed, isDisabled, text } = {}) => ({
		color: color ?? '#000000',
		colorPressed: colorPressed ?? undefined,
		onPress: jest.fn(),
		disabled: isDisabled ?? false,
		children: <Text>{text}</Text>
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	PLATFORMS.forEach(platform => {
		describe(`Platform - ${platform}`, () => {
			Platform.OS = platform;

			runRenderTextTest(TouchableNative, {
				props: createProps({
					text: 'Touchable Content'
				}),
				textToRender: [{ type: 'text', value: 'Touchable Content' }]
			});

			runPressTest(TouchableNative, {
				props: createProps({
					text: 'Press Me'
				}),
				textToPress: 'Press Me'
			});

			runPressTest(TouchableNative, {
				props: createProps({
					text: 'Colored Button',
					color: '#FF0000',
					colorPressed: '#00FF00'
				}),
				textToPress: 'Colored Button'
			});
		});
	});
});
