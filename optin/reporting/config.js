const Config = {
	/**
	 * Get data storage path from environment variables
	 * @returns {string} Data storage path
	 */
	getDataStoragePath() {
		return process.env.DATA_STORAGE_PATH || './_data';
	}
};

module.exports = Config;
