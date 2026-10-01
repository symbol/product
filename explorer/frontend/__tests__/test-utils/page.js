import '@testing-library/jest-dom';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

export const expectTexts = async expected => {
	// Async texts settle the UI first, so the absence checks below cannot pass against a not-yet-rendered state.
	await Promise.all((expected.asyncTexts || []).map(text => waitFor(() => expect(screen.getByText(text)).toBeInTheDocument())));
	(expected.hiddenTexts || []).forEach(text => expect(screen.queryByText(text)).not.toBeInTheDocument());
	(expected.texts || []).forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
	Object.entries(expected.textOccurrences || {}).forEach(([text, count]) => expect(screen.getAllByText(text)).toHaveLength(count));
	Object.entries(expected.altOccurrences || {}).forEach(([altText, count]) =>
		expect(screen.queryAllByAltText(altText)).toHaveLength(count));
};

export const clickText = text => async () => fireEvent.click(screen.getByText(text));

export const clickRoleByText = (text, role) => async () => fireEvent.click(screen.getByText(text).closest(`[role="${role}"]`));

export const waitForText = text => async () => waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());

export const flushPromises = () => async () => act(async () => {});

export const createRenderScenarioRunner = renderPage => (description, config, expected) => {
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
