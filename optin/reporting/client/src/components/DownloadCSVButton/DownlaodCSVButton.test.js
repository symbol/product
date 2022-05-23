import DownloadCSVButton from './';
import Helper from '../../utils/helper';
import {fireEvent, render, screen} from '@testing-library/react';

// Arrange:
jest.mock('./../../utils/helper', () => ({downloadAllAsCSV: jest.fn()}));

describe('DownloadCSVButton Component', () => {
	const testDownloadCSVButtonByActivePage = ({activePage, expectDownloadHelperIsCalled = true}) => {
		// Arrange more:
		render(<DownloadCSVButton activePage={activePage}/>);

		// Act:
		fireEvent.click(screen.getByRole('button'));

		// Assert:
		if (expectDownloadHelperIsCalled)
			expect(Helper.downloadAllAsCSV).toHaveBeenCalled();
		else
			expect(Helper.downloadAllAsCSV).not.toHaveBeenCalled();
	};

	it('should render download CSV button component', () => {
		// Arrange:
		render(<DownloadCSVButton activePage="completed" />);

		// Act + Assert:
		expect(screen.getByRole('button')).toBeInTheDocument();
	});

	it('should call on click handler when active page is "completed"', () => {
		testDownloadCSVButtonByActivePage({activePage:'completed'});
	});

	it('should call on click handler when active page is "in progress', () => {
		testDownloadCSVButtonByActivePage({activePage:'inProgress'});
	});

	it('should not call on click handler when active page is invalid', () => {
		testDownloadCSVButtonByActivePage({activePage:'invalid', expectDownloadHelperIsCalled: false});
	});
});
