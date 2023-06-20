import logger from '../logger.js';

class ClaimDatabase {
	constructor(connection) {
		this.connection = connection;
	}

	/**
	 * Create claimed table in database.
	 * @returns {Promise<void>} A promise that resolves when the claimed table is created successfully.
	 */
	async createTable() {
		const query = `
			CREATE TABLE IF NOT EXISTS claimed (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				twitter_handle TEXT NOT NULL,
				protocol TEXT NOT NULL,
				address TEXT NOT NULL,
				amount NUMBER NOT NULL,
				claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			);
		`;

		return new Promise(resolve => {
			this.connection.run(query, error => {
				if (error) {
					throw error;
				} else {
					logger.info('Claimed table created.');
					resolve();
				}
			});
		});
	}

	/**
	 * Insert claimed data into database.
	 * @param {{twitterHandle: string, protocol: (NEM | Symbol), amount: number, address:string}} params - The claimed data.
	 * @returns {Promise<void>} A promise that resolves when the claimed data is inserted successfully.
	 */
	async insertClaimed({
		twitterHandle, protocol, amount, address
	}) {
		const query = 'INSERT INTO claimed (twitter_handle, protocol, amount, address) VALUES (?, ?, ?, ?)';

		return new Promise(resolve => {
			this.connection.run(query, [twitterHandle, protocol, amount, address], error => {
				if (error) {
					throw error;
				} else {
					logger.info(`User ${twitterHandle} claim ${amount} token in ${protocol}.`);
					resolve();
				}
			});
		});
	}
}

export default ClaimDatabase;
