from collections import namedtuple

DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS = 60

STATISTICS_CACHE_TTL_SECONDS = 900
STATISTICS_CACHE_MAX_ENTRIES = 4
STATISTICS_RANGE_CACHE_MAX_ENTRIES = 64

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])
Pagination = namedtuple('Pagination', ['limit', 'offset'])
Sorting = namedtuple('Sorting', ['field', 'order'])
RestConfig = namedtuple('RestConfig', ['network_name', 'node_url', 'max_lag_blocks', 'harvesting_active_window_days'])
