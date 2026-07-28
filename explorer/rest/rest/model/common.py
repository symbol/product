from collections import namedtuple

DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS = 60

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])
Pagination = namedtuple('Pagination', ['limit', 'offset'])
Sorting = namedtuple('Sorting', ['field', 'order'])
RestConfig = namedtuple('RestConfig', ['network_name', 'node_url', 'max_lag_blocks', 'harvesting_active_window_days'])
