def create_symbol_health(**overrides):
	"""Creates an expected Symbol health response for tests."""

	health = {
		'isHealthy': False,
		'dbUp': False,
		'backendSynced': False,
		'lastDBSyncedAt': None,
		'lastDBHeight': None,
		'errors': []
	}
	health.update(overrides)
	return health
