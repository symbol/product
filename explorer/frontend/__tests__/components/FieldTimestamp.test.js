import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import FieldTimestamp from '@/components/FieldTimestamp';
import * as utils from '@/utils';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

describe('FieldTimestamp', () => {
	describe('expiration status', () => {
		const runTest = (timestampType, expectedInitialTitle, expectedTypeAfterClick, expectedTitleAfterClick) => {
			// Arrange:
			const value = 123456;
			const setNewType = jest.fn();
			jest.spyOn(utils, 'useStorage').mockImplementation(() => {
				return [timestampType, setNewType];
			});

			// Act:
			render(<FieldTimestamp value={value} />);

			// Assert:
			expect(screen.getByText(expectedInitialTitle)).toBeInTheDocument();
			expect(screen.queryByText(expectedTitleAfterClick)).toBeNull();
			expect(setNewType).not.toHaveBeenCalled();

			// Act:
			fireEvent.click(screen.getByText(expectedInitialTitle));

			// Assert:
			expect(setNewType).toHaveBeenCalledTimes(1);
			expect(setNewType).toHaveBeenCalledWith(expectedTypeAfterClick);
		};

		test('switches to local time', () => {
			// Arrange:
			const timestampType = 'UTC';
			const expectedInitialTitle = 'field_timestampUTC';
			const expectedTypeAfterClick = 'local';
			const expectedTitleAfterClick = 'field_timestampLocal';

			// Act + Assert:
			runTest(timestampType, expectedInitialTitle, expectedTypeAfterClick, expectedTitleAfterClick);
		});

		test('switches to UTC time', () => {
			// Arrange:
			const timestampType = 'local';
			const expectedInitialTitle = 'field_timestampLocal';
			const expectedTypeAfterClick = 'UTC';
			const expectedTitleAfterClick = 'field_timestampUTC';

			// Act + Assert:
			runTest(timestampType, expectedInitialTitle, expectedTypeAfterClick, expectedTitleAfterClick);
		});
	});
});
