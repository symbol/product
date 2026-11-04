"""Configuration for bounded account snapshot retention."""
from collections import namedtuple

# Both PostgreSQL timeout GUCs accept up to INT_MAX milliseconds.
POSTGRES_TIMEOUT_MAX_MS = 2**31 - 1
ACCOUNT_RETENTION_TIME_BUDGET_SECONDS = 5
# Three attempt windows plus two windows of overhead divide the total budget into five parts.
ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS = ACCOUNT_RETENTION_TIME_BUDGET_SECONDS * 1000 // 5


def _positive_milliseconds(value, name):
	error = f'{name} must be a positive integer in milliseconds within the PostgreSQL range'
	if isinstance(value, bool) or not isinstance(value, (int, str)):
		raise ValueError(error)

	if isinstance(value, str) and (not value.isascii() or not value.isdecimal()):
		raise ValueError(error)

	if isinstance(value, str):
		value = value.lstrip('0')
		if not value or len(value) > 10:
			raise ValueError(error)

	parsed = int(value)
	if not 1 <= parsed <= POSTGRES_TIMEOUT_MAX_MS:
		raise ValueError(error)

	return parsed


class AccountRetentionConfiguration(namedtuple('AccountRetentionConfiguration', ['statement_timeout_ms', 'lock_timeout_ms'])):
	"""Immutable and validated PostgreSQL timeout values in milliseconds."""

	__slots__ = ()

	def __new__(cls, statement_timeout_ms=2000, lock_timeout_ms=200):
		statement_timeout_ms = _positive_milliseconds(statement_timeout_ms, 'statement_timeout_ms')
		lock_timeout_ms = _positive_milliseconds(lock_timeout_ms, 'lock_timeout_ms')
		if lock_timeout_ms > ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS:
			raise ValueError(
				f'lock_timeout_ms must be at most {ACCOUNT_RETENTION_LOCK_TIMEOUT_MAX_MS} milliseconds '
				'(one-fifth of the account retention time budget)')

		if lock_timeout_ms >= statement_timeout_ms:
			raise ValueError('lock_timeout_ms must be less than statement_timeout_ms')

		return super().__new__(cls, statement_timeout_ms, lock_timeout_ms)


DEFAULT_ACCOUNT_RETENTION_CONFIGURATION = AccountRetentionConfiguration()


def create_retention_configuration(section=None):
	"""Validates the optional account retention INI section at startup."""

	if section is None:
		return DEFAULT_ACCOUNT_RETENTION_CONFIGURATION

	return AccountRetentionConfiguration(
		section.get('statement_timeout_ms', DEFAULT_ACCOUNT_RETENTION_CONFIGURATION.statement_timeout_ms),
		section.get('lock_timeout_ms', DEFAULT_ACCOUNT_RETENTION_CONFIGURATION.lock_timeout_ms))
