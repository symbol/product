import '@testing-library/jest-dom';
import { activeVariant, formatVariantDescription } from './variants';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

const CLEAR_FILTER_TEXT = 'button_clear';
const TRY_AGAIN_TEXT = 'button_tryAgain';

export const expectTexts = async expected => {
	// Async texts settle the UI first, so the absence checks below cannot pass against a not-yet-rendered state.
	await Promise.all((expected.asyncTexts || []).map(text => waitFor(() => expect(screen.getByText(text)).toBeInTheDocument())));
	await Promise.all(Object.entries(expected.asyncTextOccurrences || {}).map(([text, count]) =>
		waitFor(() => expect(screen.getAllByText(text)).toHaveLength(count))));
	(expected.hiddenTexts || []).forEach(text => expect(screen.queryByText(text)).not.toBeInTheDocument());
	(expected.texts || []).forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
	Object.entries(expected.textOccurrences || {}).forEach(([text, count]) => expect(screen.getAllByText(text)).toHaveLength(count));
	Object.entries(expected.altOccurrences || {}).forEach(([altText, count]) =>
		expect(screen.queryAllByAltText(altText)).toHaveLength(count));
	(expected.titles || []).forEach(title => expect(screen.getByTitle(title)).toBeInTheDocument());
	Object.entries(expected.titleOccurrences || {}).forEach(([title, count]) =>
		expect(screen.queryAllByTitle(title)).toHaveLength(count));
};

export const clickText = text => async () => fireEvent.click(screen.getByText(text));

export const clickRoleByText = (text, role) => async () => fireEvent.click(screen.getByText(text).closest(`[role="${role}"]`));

export const waitForText = text => async () => waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());

export const flushPromises = () => async () => act(async () => {});

// The chip ignores clicks while a request is in flight, so interactions wait for it to be enabled first.
const getEnabledFilterChip = async chipText => {
	const filterChip = screen.getByText(chipText).closest('[role="button"]');
	await waitFor(() => expect(filterChip).toHaveAttribute('aria-disabled', 'false'));

	return filterChip;
};

export const toggleFilterChip = chipText => async () => fireEvent.click(await getEnabledFilterChip(chipText));

export const clearFilterChip = chipText => async () => {
	const filterChip = await getEnabledFilterChip(chipText);
	// A page may render several filters, so click the clear button next to this chip.
	fireEvent.click(within(filterChip.parentElement).getByText(CLEAR_FILTER_TEXT));
};

// A case may declare `variants: ['nem']` to run only in those variants' passes (skipped in the others).
export const runTestCases = (runTest, cases) =>
	cases.forEach(({ description, variants, config, expected }) => {
		if (!variants) {
			runTest(description, config, expected);

			return;
		}

		const variantDescription = formatVariantDescription(variants, description);
		if (variants.includes(activeVariant)) 
			runTest(variantDescription, config, expected);
		else 
			it.skip(variantDescription, () => {});
	});

export const runGetServerSidePropsTests = ({ getServerSideProps, params, requests, cases }) => {
	const runGetServerSidePropsTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange: mock every request with this case's response.
			Object.entries(requests).forEach(([name, [serviceModule, serviceMethod]]) =>
				jest.spyOn(serviceModule, serviceMethod).mockResolvedValue(config.responses[name]));

			// Act:
			const result = await getServerSideProps({
				locale: 'en',
				params
			});

			// Assert: a request listed in expected.requestArguments was made with those arguments ([] = no arguments),
			// a request left out was not made at all.
			Object.entries(requests).forEach(([name, [serviceModule, serviceMethod]]) => {
				if (name in expected.requestArguments)
					expect(serviceModule[serviceMethod]).toHaveBeenCalledWith(...expected.requestArguments[name]);
				else
					expect(serviceModule[serviceMethod]).not.toHaveBeenCalled();
			});
			expect(result).toEqual(expected.result);
		});
	};

	runTestCases(runGetServerSidePropsTest, cases);
};

export const runRenderScenarioTests = ({ renderPage, cases }) => {
	const runRenderScenarioTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange + Act:
			renderPage(config);

			// Flush the mount requests, so async state is applied before acting and asserting.
			await act(async () => {});

			for (const action of config.actions || []) {
				// eslint-disable-next-line no-await-in-loop
				await action();
			}

			// Assert:
			await expectTexts(expected);
		});
	};

	runTestCases(runRenderScenarioTest, cases);
};

export const runSearchCriteriaTests = ({ renderPage, request, cases }) => {
	const [serviceModule, serviceMethod] = request;

	const runSearchCriteriaTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange:
			renderPage(config);

			// Act:
			for (const action of config.actions || []) {
				// eslint-disable-next-line no-await-in-loop
				await action();
			}

			// Assert:
			await waitFor(() => expect(serviceModule[serviceMethod]).toHaveBeenLastCalledWith(expected.searchCriteria));
		});
	};

	runTestCases(runSearchCriteriaTest, cases);
};

export const runTableErrorTest = (description, { renderPage, request }) => {
	const [serviceModule, serviceMethod] = request;

	it(description, async () => {
		// Arrange: silence the pagination error log.
		jest.spyOn(console, 'error').mockImplementation();
		serviceModule[serviceMethod].mockRejectedValue(new Error(`${serviceMethod} request failed`));

		// Act:
		renderPage();

		// Assert:
		await waitFor(() => expect(screen.getByText(TRY_AGAIN_TEXT)).toBeInTheDocument());
	});
};
