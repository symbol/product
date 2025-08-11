const path = require('path');

module.exports = {
	i18n: {
		locales: ['en', 'ja', 'isv'],
		defaultLocale: 'en',
		reloadOnPrerender: true
	},
	reloadOnPrerender: true,
	localePath: path.resolve('./public/locales')
};
