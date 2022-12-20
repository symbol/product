import breakpoints from './breakpoints';
import defaultConfig from './default';

const config = {
	BREAKPOINTS: breakpoints,
	NODE_URL: process.env.REACT_APP_NODE_URL ?? defaultConfig.NODE_URL,
	URL_GITHUB: process.env.REACT_APP_URL_GITHUB ?? defaultConfig.URL_GITHUB,
	URL_TWITTER: process.env.REACT_APP_URL_TWITTER ?? defaultConfig.URL_TWITTER,
	URL_DISCORD: process.env.REACT_APP_URL_DISCORD ?? defaultConfig.URL_DISCORD,
	URL_EXPLORER: process.env.REACT_APP_URL_EXPLORER ?? defaultConfig.URL_EXPLORER,
	URL_TELEGRAM_CH_HELPDESK: process.env.REACT_APP_URL_TELEGRAM_CH_HELPDESK ?? defaultConfig.URL_TELEGRAM_CH_HELPDESK,
	TELEGRAM_CH_HELPDESK: process.env.REACT_APP_TELEGRAM_CH_HELPDESK ?? defaultConfig.TELEGRAM_CH_HELPDESK,
	URL_DISCORD_CH_HELPDESK: process.env.REACT_APP_URL_DISCORD_CH_HELPDESK ?? defaultConfig.URL_DISCORD_CH_HELPDESK,
	DISCORD_CH_HELPDESK: process.env.REACT_APP_DISCORD_CH_HELPDESK ?? defaultConfig.DISCORD_CH_HELPDESK,
	FAUCET_ADDRESS: process.env.REACT_APP_FAUCET_ADDRESS ?? defaultConfig.FAUCET_ADDRESS,
	MAX_AMOUNT: process.env.REACT_APP_MAX_SEND_AMOUNT ?? defaultConfig.MAX_AMOUNT,
	CURRENCY: process.env.REACT_APP_CURRENCY ?? defaultConfig.CURRENCY,
	DIVISIBILITY: process.env.REACT_APP_DIVISIBILITY ?? defaultConfig.DIVISIBILITY,
	MIN_FOLLOWERS_COUNT: process.env.REACT_APP_MIN_FOLLOWERS_COUNT ?? defaultConfig.MIN_FOLLOWERS_COUNT,
	MIN_ACCOUNT_AGE: process.env.REACT_APP_MIN_ACCOUNT_AGE ?? defaultConfig.MIN_ACCOUNT_AGE,
	BACKEND_URL: process.env.REACT_APP_BACKEND_URL ?? defaultConfig.BACKEND_URL,
	AUTH_URL: process.env.REACT_APP_AUTH_URL ?? defaultConfig.AUTH_URL
};

export default config;
