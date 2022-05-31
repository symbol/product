const fs = require('fs');
const path = require('path');

const controller = {
	routeHandler: async (_, res) => {
		const indexPage = path.join(__dirname, '../client/build/index.html');

		if (fs.existsSync(indexPage))
			res.sendFile(indexPage);
		else
			res.status(404).send('Page not found');
	}
};

module.exports = controller;
