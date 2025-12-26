import { TextBox } from '@/app/components/controls/TextBox';
import { runInputTextTest, runRenderTextTest } from '__tests__/component-tests';

describe('components/TextBox', () => {
	const createProps = ({ placeholder, label = 'Test input', isDisabled, value } = {}) => ({
		value: value ?? '',
		label,
		placeholder: placeholder ?? 'Enter text',
		isDisabled: isDisabled ?? false,
		onChange: jest.fn()
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	runRenderTextTest(TextBox, {
		props: createProps(),
		textToRender: [
			{ type: 'text', value: 'Test input' },
			{ type: 'placeholder', value: 'Enter text' }
		]
	});

	runInputTextTest(TextBox, {
		props: createProps({ 
			placeholder: 'Enter text', 
			value: '' 
		}),
		textToFocus: {
			type: 'placeholder', value: 'Enter text'
		},
		testDisabledState: true
	});

	runInputTextTest(TextBox, {
		props: createProps({ 
			placeholder: '', 
			value: 'abc', 
			label: 'Test input'
		}),
		textToFocus: {
			type: 'input', value: 'abc'
		},
		testDisabledState: true
	});

	runInputTextTest(TextBox, {
		props: createProps({ 
			placeholder: '', 
			value: '' 
		}),
		textToFocus: {
			type: 'label', value: 'Test input'
		},
		testDisabledState: true
	});
});
