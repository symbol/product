import testing.postgresql


def create_test_db_config():
	postgresql = testing.postgresql.Postgresql()
	url_parts = postgresql.url().split('/')
	host_port = url_parts[2].split('@')[1].split(':')
	db_config = {
		'database': url_parts[-1],
		'user': 'postgres',
		'password': '',
		'host': host_port[0],
		'port': url_parts[-2].split(':')[-1],
	}
	return postgresql, db_config
