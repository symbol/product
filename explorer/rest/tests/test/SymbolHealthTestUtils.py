def create_symbol_health(**overrides):
	health = {
		'isHealthy': False,
		'dbUp': False,
		'nodeConfigured': False,
		'backendSynced': False,
		'lastDBSyncedAt': None,
		'lastDBHeight': None,
		'errors': []
	}
	health.update(overrides)
	return health
