import { copyToClipboard, createPageHref, handleNavigationItemClick } from '@/utils/client';

describe('utils/client', () => {
	describe('copyToClipboard', () => {
		afterEach(() => {
			delete navigator.clipboard;
			delete document.execCommand;
		});

		it('copies text string using navigator API', async () => {
			// Arrange:
			const textToCopy = 'foo';
			const writeText = jest.fn().mockResolvedValue();
			navigator.clipboard = {
				writeText
			};

			// Act:
			await copyToClipboard(textToCopy);

			// Assert:
			expect(writeText).toHaveBeenCalledWith(textToCopy);
		});

		it('copies text string using fallback', async () => {
			// Arrange:
			const textToCopy = 'foo';
			document.execCommand = jest.fn().mockReturnValue(true);
			jest.spyOn(document.body, 'appendChild');
			jest.spyOn(document.body, 'removeChild');

			// Act:
			await copyToClipboard(textToCopy);

			// Assert:
			expect(document.execCommand).toHaveBeenCalledWith('copy');
			expect(document.body.removeChild).toHaveBeenCalledTimes(1);
			expect(document.body.appendChild).toBeCalledWith(expect.objectContaining({
				value: textToCopy
			}));
		});

		it('throws an error when failed to copy', async () => {
			// Arrange:
			const textToCopy = 'foo';
			document.execCommand = jest.fn().mockReturnValue(false);
			jest.spyOn(document.body, 'appendChild');
			jest.spyOn(document.body, 'removeChild');
			const expectedError = Error('Failed to copy to clipboard');

			// Act:
			const promise = copyToClipboard(textToCopy);

			// Assert:
			return expect(promise).rejects.toStrictEqual(expectedError);
		});
	});

	describe('createPageHref', () => {
		const runCreatePageHrefTest = (pageName, parameter, expectedResult) => {
			// Act:
			const result = createPageHref(pageName, parameter);

			// Assert:
			expect(result).toBe(expectedResult);
		};

		it('creates home page link', () => {
			// Arrange:
			const pageName = 'home';
			const parameter = undefined;
			const expectedResult = '/';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates accounts page link', () => {
			// Arrange:
			const pageName = 'accounts';
			const parameter = undefined;
			const expectedResult = '/accounts';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates account info page link', () => {
			// Arrange:
			const pageName = 'accounts';
			const parameter = 'foo';
			const expectedResult = '/accounts/foo';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates blocks page link', () => {
			// Arrange:
			const pageName = 'blocks';
			const parameter = undefined;
			const expectedResult = '/blocks';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates block info page link', () => {
			// Arrange:
			const pageName = 'blocks';
			const parameter = 'foo';
			const expectedResult = '/blocks/foo';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates mosaics page link', () => {
			// Arrange:
			const pageName = 'mosaics';
			const parameter = undefined;
			const expectedResult = '/mosaics';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates mosaic info page link', () => {
			// Arrange:
			const pageName = 'mosaics';
			const parameter = 'foo';
			const expectedResult = '/mosaics/foo';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates namespaces page link', () => {
			// Arrange:
			const pageName = 'namespaces';
			const parameter = undefined;
			const expectedResult = '/namespaces';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates namespace info page link', () => {
			// Arrange:
			const pageName = 'namespaces';
			const parameter = 'foo';
			const expectedResult = '/namespaces/foo';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates transactions page link', () => {
			// Arrange:
			const pageName = 'transactions';
			const parameter = undefined;
			const expectedResult = '/transactions';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates transaction info page link', () => {
			// Arrange:
			const pageName = 'transactions';
			const parameter = 'foo';
			const expectedResult = '/transactions/foo';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});

		it('creates default page link', () => {
			// Arrange:
			const pageName = 'foo';
			const parameter = undefined;
			const expectedResult = '/';

			// Act + Assert:
			runCreatePageHrefTest(pageName, parameter, expectedResult);
		});
	});

	describe('handleNavigationItemClick', () => {
		const runHandleNavigationItemClickTest = (isNavigationDisabled, onClick, shouldCallOnClick, shouldCallPreventDefault) => {
			// Arrange:
			const event = {
				stopPropagation: jest.fn(),
				preventDefault: jest.fn()
			};
			const value = 'foo';

			// Act:
			handleNavigationItemClick(event, onClick, value, isNavigationDisabled);

			// Assert:
			expect(event.stopPropagation).toHaveBeenCalledTimes(1);
			if (shouldCallOnClick)
				expect(onClick).toHaveBeenCalledWith(value);
			if (shouldCallPreventDefault)
				expect(event.preventDefault).toHaveBeenCalledTimes(1);
		};

		it('does not call onClick when is not provided', () => {
			// Arrange:
			const isNavigationDisabled = false;
			const onClick = undefined;
			const shouldCallOnClick = false;
			const shouldCallPreventDefault = false;

			// Act + Assert:
			runHandleNavigationItemClickTest(isNavigationDisabled, onClick, shouldCallOnClick, shouldCallPreventDefault);
		});

		it('calls onClick when provided', () => {
			// Arrange:
			const isNavigationDisabled = false;
			const onClick = jest.fn();
			const shouldCallOnClick = true;
			const shouldCallPreventDefault = false;

			// Act + Assert:
			runHandleNavigationItemClickTest(isNavigationDisabled, onClick, shouldCallOnClick, shouldCallPreventDefault);
		});

		it('prevents default action when navigation is disabled', () => {
			// Arrange:
			const isNavigationDisabled = true;
			const onClick = jest.fn();
			const shouldCallOnClick = true;
			const shouldCallPreventDefault = true;

			// Act + Assert:
			runHandleNavigationItemClickTest(isNavigationDisabled, onClick, shouldCallOnClick, shouldCallPreventDefault);
		});
	});
});
