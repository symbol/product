def create_symbol_health(**overrides):
	"""Creates an expected Symbol health response for tests."""

	health = {
		'isHealthy': False,
		'dbUp': False,
		'finalizedHeight': None,
		'backendSynced': False,
		'lastDBSyncedAt': None,
		'lastDBHeight': None,
		'status': None,
		'errors': []
	}
	health.update(overrides)
	return health
