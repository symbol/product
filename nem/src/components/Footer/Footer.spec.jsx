/* eslint-disable testing-library/no-node-access */
import Footer from '.';
import * as i18n from '../../i18n';
import { render, screen } from '@testing-library/react';

const Config = {
	URL_EXPLORER: 'https://explorer.dev',
	URL_DISCORD: 'https://discord.gg/link',
	URL_GITHUB: 'https://github.org/org',
	URL_TWITTER: 'https://twitter.com/community'
};
jest.mock('../../config', () => Config, { virtual: true });

beforeEach(() => {
	jest.spyOn(i18n, '$t').mockImplementation(key => `translated_${key}`);
});

describe('components/Footer', () => {
	it('should render links', () => {
		// Arrange:
		const explorerLinkText = 'translated_footer_link_explorer';
		const discordLinkText = 'translated_footer_link_discord';
		const githubLinkText = 'translated_footer_link_github';
		const twitterLinkText = 'translated_footer_link_twitter';

		const explorerLinkUrl = Config.URL_EXPLORER;
		const discordLinkUrl = Config.URL_DISCORD;
		const githubLinkUrl = Config.URL_GITHUB;
		const twitterLinkUrl = Config.URL_TWITTER;

		// Act:
		render(<Footer />);
		const explorerLinkElement = screen.getByText(explorerLinkText).parentElement;
		const discordLinkElement = screen.getByText(discordLinkText).parentElement;
		const githubLinkElement = screen.getByText(githubLinkText).parentElement;
		const twitterLinkElement = screen.getByText(twitterLinkText).parentElement;

		// Assert:
		expect(explorerLinkElement).toHaveAttribute('href', explorerLinkUrl);
		expect(discordLinkElement).toHaveAttribute('href', discordLinkUrl);
		expect(githubLinkElement).toHaveAttribute('href', githubLinkUrl);
		expect(twitterLinkElement).toHaveAttribute('href', twitterLinkUrl);
	});
});
