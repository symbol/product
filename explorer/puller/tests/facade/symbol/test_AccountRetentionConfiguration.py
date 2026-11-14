"""Startup coverage for Symbol account retention timeout configuration."""
import pytest

from puller.db.AccountRetentionConfiguration import (
	ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS,
	ACCOUNT_RETENTION_TIME_BUDGET_SECONDS,
	AccountRetentionConfiguration
)

from .puller_test_utils import create_db_config, create_symbol_puller

STATEMENT_ERROR = 'statement_timeout_ms must be a positive integer in milliseconds within the PostgreSQL range'
LOCK_ERROR = 'lock_timeout_ms must be a positive integer in milliseconds within the PostgreSQL range'
LOCK_LIMIT_ERROR = (
	f'lock_timeout_ms must be at most {ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS} milliseconds '
	'(one-fifth of the account retention time budget)')


def _write_retention_config(tmp_path, entries):
	path = create_db_config(tmp_path)
	if entries is not None:
		with path.open('a', encoding='utf8') as config_file:
			config_file.write('\n[symbol_account_retention]\n')
			for name, value in entries.items():
				config_file.write(f'{name} = {value}\n')

	return path


@pytest.mark.parametrize(('entries', 'expected'), [
	(None, (2000, 200)),
	({}, (2000, 200)),
	({'statement_timeout_ms': '3000', 'lock_timeout_ms': '125'}, (3000, 125)),
	({'statement_timeout_ms': str(ACCOUNT_RETENTION_TIME_BUDGET_SECONDS * 2000),
		'lock_timeout_ms': str(ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS - 1)},
		(ACCOUNT_RETENTION_TIME_BUDGET_SECONDS * 2000, ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS - 1)),
	({'statement_timeout_ms': '2147483647', 'lock_timeout_ms': str(ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS - 1)},
		(2147483647, ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS - 1)),
	({'statement_timeout_ms': '201'}, (201, 200)),
	({'lock_timeout_ms': '1'}, (2000, 1)),
	({'lock_timeout_ms': '0' * 5000 + '1'}, (2000, 1)),
	({'statement_timeout_ms': '00000000003000', 'lock_timeout_ms': '000125'}, (3000, 125)),
	({'statement_timeout_ms': '2147483647', 'lock_timeout_ms': str(ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS)},
		(2147483647, ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS))
])
def test_puller_loads_retention_timeouts(tmp_path, entries, expected):
	# Arrange: build the same INI consumed by the Symbol workflow.
	config_path = _write_retention_config(tmp_path, entries)

	# Act: constructing the facade validates and passes retention settings to the DB owner.
	puller = create_symbol_puller(config_path)

	# Assert:
	assert expected == tuple(puller.symbol_db.retention_config)
	assert puller.symbol_db.connection is None


@pytest.mark.parametrize(('entries', 'error'), [
	({'statement_timeout_ms': '0'}, STATEMENT_ERROR),
	({'statement_timeout_ms': '-1'}, STATEMENT_ERROR),
	({'statement_timeout_ms': '1.5'}, STATEMENT_ERROR),
	({'statement_timeout_ms': 'true'}, STATEMENT_ERROR),
	({'statement_timeout_ms': ''}, STATEMENT_ERROR),
	({'statement_timeout_ms': '١٢'}, STATEMENT_ERROR),
	({'statement_timeout_ms': '2147483648'}, STATEMENT_ERROR),
	({'statement_timeout_ms': '99999999999'}, STATEMENT_ERROR),
	({'statement_timeout_ms': '9' * 5000}, STATEMENT_ERROR),
	({'statement_timeout_ms': '0' * 5000}, STATEMENT_ERROR),
	({'lock_timeout_ms': '0'}, LOCK_ERROR),
	({'lock_timeout_ms': '-1'}, LOCK_ERROR),
	({'lock_timeout_ms': 'not-a-number'}, LOCK_ERROR),
	({'statement_timeout_ms': '2147483647', 'lock_timeout_ms': str(ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS + 1)},
		LOCK_LIMIT_ERROR),
	({'statement_timeout_ms': '2147483647', 'lock_timeout_ms': '4999'}, LOCK_LIMIT_ERROR),
	({'statement_timeout_ms': '2147483647', 'lock_timeout_ms': '2147483648'}, LOCK_ERROR),
	({'statement_timeout_ms': '200', 'lock_timeout_ms': '200'}, 'lock_timeout_ms must be less than statement_timeout_ms'),
	({'statement_timeout_ms': '100', 'lock_timeout_ms': '200'}, 'lock_timeout_ms must be less than statement_timeout_ms')
])
def test_constructor_rejects_invalid_ini(tmp_path, entries, error):
	# Arrange: write malformed retention values into the INI consumed by SymbolPuller.
	config_path = _write_retention_config(tmp_path, entries)

	# Act: construction loads and validates the INI before entering the DB connection lifecycle.
	with pytest.raises(ValueError) as context:
		create_symbol_puller(config_path)

	# Assert:
	assert error == str(context.value)


@pytest.mark.parametrize('value', [True, False, None, 1.5, 0, -1, 2147483648])
def test_timeout_config_rejects_values(value):
	# Act: direct value-object construction cannot bypass startup validation.
	with pytest.raises(ValueError) as context:
		AccountRetentionConfiguration(value, 1)

	# Assert:
	assert STATEMENT_ERROR == str(context.value)
