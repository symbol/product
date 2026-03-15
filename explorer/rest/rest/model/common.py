from collections import namedtuple

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])
Pagination = namedtuple('Pagination', ['limit', 'offset'])
Sorting = namedtuple('Sorting', ['field', 'order'])
RestConfig = namedtuple('RestConfig', ['network_name', 'node_url', 'max_lag_blocks'])
