import breakpoints from './breakpoints.json';
import defaultConfig from './default.json';

const config = {
	BREAKPOINTS: breakpoints,
	URL_GITHUB: process.env.NEXT_PUBLIC_URL_GITHUB ?? defaultConfig.URL_GITHUB,
	URL_TWITTER: process.env.NEXT_PUBLIC_URL_TWITTER ?? defaultConfig.URL_TWITTER,
	URL_DISCORD: process.env.NEXT_PUBLIC_URL_DISCORD ?? defaultConfig.URL_DISCORD,
	URL_EXPLORER: process.env.NEXT_PUBLIC_URL_EXPLORER ?? defaultConfig.URL_EXPLORER,
	URL_TELEGRAM_CH_HELP_DESK: process.env.NEXT_PUBLIC_URL_TELEGRAM_CH_HELPDESK ?? defaultConfig.URL_TELEGRAM_CH_HELP_DESK,
	TELEGRAM_CH_HELP_DESK: process.env.NEXT_PUBLIC_TELEGRAM_CH_HELPDESK ?? defaultConfig.TELEGRAM_CH_HELP_DESK,
	URL_DISCORD_CH_HELP_DESK: process.env.NEXT_PUBLIC_URL_DISCORD_CH_HELPDESK ?? defaultConfig.URL_DISCORD_CH_HELP_DESK,
	DISCORD_CH_HELP_DESK: process.env.NEXT_PUBLIC_DISCORD_CH_HELPDESK ?? defaultConfig.DISCORD_CH_HELP_DESK,
	BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultConfig.BACKEND_URL,
	AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL ?? defaultConfig.AUTH_URL,
	AES_SECRET: process.env.NEXT_PUBLIC_AES_SECRET ?? defaultConfig.AES_SECRET
};

export default config;
