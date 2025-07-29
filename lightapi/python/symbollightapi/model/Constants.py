from collections import namedtuple
from enum import Enum

DEFAULT_ASYNC_LIMITER_ARGUMENTS = (20, 0.1)  # allow up to 20 requests every 0.1 seconds

TimeoutSettings = namedtuple('TimeoutSettings', ['retry_count', 'interval'])


class TransactionStatus(Enum):
	"""Status of a transaction."""

	UNCONFIRMED = 1
	CONFIRMED = 2
