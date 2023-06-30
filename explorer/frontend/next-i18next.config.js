const path = require('path');

module.exports = {
	i18n: {
		locales: ['en', 'uk'],
		defaultLocale: 'en'
	},
	localePath: path.resolve('./public/locales')
};
