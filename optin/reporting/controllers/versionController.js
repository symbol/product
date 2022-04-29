const fs = require('fs');

const controller = {
	getVersion: async (_, res) => {
		const filePath = './data/current.version';
		let versionId = '';
		let	lastUpdated = '';
		if (fs.existsSync(filePath)) {
			const fileContent = fs.readFileSync(
				filePath,
				{ encoding: 'utf8', flag: 'r' }
			);
			const lines = fileContent.split(/\r?\n/); // first line is "version id", second one is "last update time"
			versionId = lines[0];
			lastUpdated = lines[1];
		}
		res.json({ versionId, lastUpdated });
	}

};

module.exports = controller;
