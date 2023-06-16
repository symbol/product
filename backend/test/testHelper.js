const testHelper = {
	readDB: (connection, queryType, query) => new Promise((resolve, reject) => {
		connection[queryType](query, (err, row) => {
			if (err)
				reject(err);
			resolve(row);
		});
	})
};

export default testHelper;
