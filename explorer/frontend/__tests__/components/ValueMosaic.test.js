import '@testing-library/jest-dom';
import { expectTexts, runTestCases } from '../test-utils/page';
import ValueMosaic from '@/app/components/ValueMosaic';
import { render } from '@testing-library/react';

// Constants

const emptyAmountText = '-';
const mosaicId = 'custom.mosaic';
const mosaicName = 'custom.mosaic';

// Tests

describe('components/ValueMosaic', () => {
	const runValueMosaicTest = (description, config, expected) => {
		it(description, async () => {
			// Act:
			render(<ValueMosaic isNative {...config.props} />);

			// Assert:
			await expectTexts(expected);
		});
	};

	const valueMosaicCases = [
		{
			description: 'renders the amount when the amount is provided',
			config: {
				props: { amount: 12.5 }
			},
			expected: {
				texts: ['12', '.5'],
				hiddenTexts: [emptyAmountText]
			}
		},
		{
			description: 'renders the amount when the amount is zero',
			config: {
				props: { amount: 0 }
			},
			expected: {
				texts: ['0'],
				hiddenTexts: [emptyAmountText]
			}
		},
		{
			description: 'renders the dash placeholder when the amount is null',
			config: {
				props: { amount: null }
			},
			expected: {
				texts: [emptyAmountText]
			}
		},
		{
			description: 'renders the mosaic name and does not render the placeholder when the amount is null and the size is medium',
			config: {
				props: {
					amount: null,
					size: 'md',
					isNative: false,
					mosaicId,
					mosaicName
				}
			},
			expected: {
				texts: [mosaicName],
				hiddenTexts: [emptyAmountText]
			}
		}
	];

	runTestCases(runValueMosaicTest, valueMosaicCases);
});
