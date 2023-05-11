import HomeContainer from '.';
import { render, screen } from '@testing-library/react';

describe('components/HomeContainer', () => {
	const homeConfig = {
		claimUrl: '/claim/token',
		transactionHashExplorerPath: '/#/s_tx?hash=',
		accountExplorerPath: '/account/path=',
		logoWord: 'image/word.png',
		logoImage: 'image/logo-image.png',
		footerLinks: [
			{
				href: 'footer-1/url',
				text: 'footer-1',
				icon: 'image/icon-footer-1.png'
			},
			{
				href: 'footer-2/url',
				text: 'footer-2',
				icon: 'image/icon-footer-2.png'
			}
		]
	};

	const config = {
		FAUCET_ADDRESS: 'faucet_address',
		URL_TELEGRAM_CH_HELP_DESK: 'telegram/channel/url',
		TELEGRAM_CH_HELP_DESK: '@telegram',
		URL_DISCORD_CH_HELP_DESK: 'discord/channel/url',
		DISCORD_CH_HELP_DESK: '@discord',
		URL_EXPLORER: 'explorer/url',
		MAX_AMOUNT: 100,
		DIVISIBILITY: 2
	};

	it('renders logo image in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const logoElement = screen.getByAltText('Logo');
		const faucetElement = screen.getByAltText('Faucet');

		// Assert:
		expect(logoElement).toHaveAttribute('src', 'image/logo-image.png');
		expect(faucetElement).toHaveAttribute('src', 'image/word.png');
	});

	it('renders faucet address element in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const elementText = screen.getByText('faucet_address');

		expect(elementText).toHaveAttribute('href', `${config.URL_EXPLORER}${homeConfig.accountExplorerPath}${config.FAUCET_ADDRESS}`);
	});

	it('renders help desk in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const telegramElement = screen.getByText('@telegram');
		const discordElement = screen.getByText('@discord');

		// Assert:
		expect(telegramElement).toHaveAttribute('href', 'telegram/channel/url');
		expect(discordElement).toHaveAttribute('href', 'discord/channel/url');
	});

	it('renders footer links in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const footer = screen.getAllByTestId('footer');

		// Assert:
		expect(footer).toHaveLength(2);
		footer.forEach((item, index) => {
			const linkIcon = screen.getByAltText(`footer-${index + 1}`);

			expect(linkIcon).toHaveAttribute('src', `image/icon-footer-${index + 1}.png`);
			expect(item).toHaveAttribute('href', `footer-${index + 1}/url`);
		});
	});

	it('renders faucet form in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const faucetFormElement = screen.getByTestId('faucet-form');

		// Assert:
		expect(faucetFormElement).toBeInTheDocument();
	});

	it('renders home description in home container', () => {
		// Arrange:
		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		// Act:
		const homeDescriptionElement = screen.getByText($t('home_description'));

		// Assert:
		expect(homeDescriptionElement).toBeInTheDocument();
	});
});
