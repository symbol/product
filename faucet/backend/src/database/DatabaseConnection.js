import logger from '../logger.js';
import sqlite3 from 'sqlite3';

const { Database, OPEN_READWRITE } = sqlite3.verbose();

class DatabaseConnection {
	constructor(dbPath) {
		this.connection = new Database(dbPath, OPEN_READWRITE, error => {
			if (error)
				throw error;
			logger.info('Connected to the database.');
		});
	}

	close() {
		this.connection.close(error => {
			if (error)
				throw error;
			logger.info('Closed the database connection.');
		});
	}
}

export default DatabaseConnection;
