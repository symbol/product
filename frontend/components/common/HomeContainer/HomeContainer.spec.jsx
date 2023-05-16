import HomeContainer from '.';
import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';

describe('components/HomeContainer', () => {
	const homeConfig = {
		claimUrl: '/claim/token',
		configUrl: '/config/token',
		transactionHashExplorerPath: '/#/s_tx?hash=',
		accountExplorerPath: '/account/path=',
		logoWord: {
			src: 'image/word.png'
		},
		logoImage: {
			src: 'image/logo-image.png'
		},
		footerLinks: [
			{
				href: 'footer-1/url',
				text: 'footer-1',
				icon: {
					src: 'image/icon-footer-1.png'
				}
			},
			{
				href: 'footer-2/url',
				text: 'footer-2',
				icon: {
					src: 'image/icon-footer-2.png'
				}
			}
		]
	};

	const config = {
		URL_TELEGRAM_CH_HELP_DESK: 'telegram/channel/url',
		TELEGRAM_CH_HELP_DESK: '@telegram',
		URL_DISCORD_CH_HELP_DESK: 'discord/channel/url',
		DISCORD_CH_HELP_DESK: '@discord',
		URL_EXPLORER: 'explorer/url'
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

	it('renders faucet balance in home container', async () => {
		// Arrange:
		jest.spyOn(axios, 'create').mockReturnValue({
			get: (url, ...params) => axios.get(url, ...params),
			defaults: {}
		});

		jest.spyOn(axios, 'get').mockReturnValue({
			data: {
				faucetAddress: 'Faucet_address',
				currency: 'TOKEN',
				sendOutMaxAmount: 0,
				mosaicDivisibility: 6,
				minFollowers: 10,
				minAccountAge: 30,
				faucetBalance: 100000000
			}
		});

		render(<HomeContainer
			homeConfig={homeConfig}
			Config={config}
		/>);

		await waitFor(() => {
			// Act:
			const faucetBalanceElement = screen.getByText('100 TOKEN');

			// Assert:
			expect(axios.get).toHaveBeenCalledWith('/config/token');
			expect(faucetBalanceElement).toBeInTheDocument();
		});
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
