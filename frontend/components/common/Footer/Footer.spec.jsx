import Footer from '.';
import { render, screen } from '@testing-library/react';

const Config = {
	URL_EXPLORER: 'https://explorer.dev',
	URL_DISCORD: 'https://discord.gg/link',
	URL_GITHUB: 'https://github.org/org',
	URL_TWITTER: 'https://twitter.com/community'
};

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

		const footerLinks = [
			{
				href: explorerLinkUrl,
				text: explorerLinkText,
				icon: {
					src: 'image/explorer.png'
				}
			},
			{
				href: discordLinkUrl,
				text: discordLinkText,
				icon: {
					src: 'image/discord.png'
				}
			},
			{
				href: githubLinkUrl,
				text: githubLinkText,
				icon: {
					src: 'image/github.png'
				}
			},
			{
				href: twitterLinkUrl,
				text: twitterLinkText,
				icon: {
					src: 'image/twitter.png'
				}
			}
		];

		// Act:
		render(<Footer links={footerLinks} />);

		// Assert:
		footerLinks.forEach(link => {
			const linkElement = screen.getByText(link.text);
			expect(linkElement).toBeInTheDocument();
			expect(linkElement.closest('a')).toHaveAttribute('href', link.href);
		});

		const icons = screen.getAllByRole('img');
		icons.forEach((icon, i) => {
			expect(icon).toHaveAttribute('src', footerLinks[i].icon.src);
			expect(icon).toHaveAttribute('alt', footerLinks[i].text);
		});
	});
});
