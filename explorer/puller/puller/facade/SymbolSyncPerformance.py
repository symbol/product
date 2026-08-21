"""Per-run performance state for Symbol block synchronization."""

from contextlib import contextmanager

HTTP_CATEGORIES = (
	'block',
	'confirmed_transaction',
	'transaction_statement',
	'address_resolution',
	'mosaic_resolution',
	'account_batch',
	'account_multisig',
	'namespace_detail',
	'namespace_name',
	'mosaic_batch',
	'metadata_search',
	'hash_lock',
	'secret_lock',
	'mosaic_restriction',
	'chain_or_network',
	'other'
)

PHASE_FIELDS = (
	'block_fetch_ms',
	'transaction_fetch_ms',
	'receipt_fetch_ms',
	'resolution_fetch_ms',
	'account_fetch_ms',
	'namespace_fetch_ms',
	'mosaic_fetch_ms',
	'metadata_fetch_ms',
	'hash_lock_fetch_ms',
	'secret_lock_fetch_ms',
	'mosaic_restriction_fetch_ms'
)

DIRTY_FIELDS = (
	'dirty_account_count',
	'dirty_namespace_count',
	'dirty_mosaic_count',
	'dirty_metadata_count',
	'dirty_hash_lock_count',
	'dirty_secret_lock_count',
	'dirty_mosaic_restriction_count'
)

COUNT_FIELDS = (
	'block_count',
	'transaction_count',
	'receipt_count',
	'http_attempt_count',
	'http_success_count',
	'http_retry_count',
	'http_get_attempt_count',
	'http_post_attempt_count',
	'rate_limit_wait_ms',
	'db_commit_count',
	'db_commit_attempt_count'
)

DB_FIELDS = (
	'block_transaction_receipt_write_ms',
	'account_multisig_write_ms',
	'current_state_write_ms',
	'db_write_total_ms',
	'db_commit_ms'
)

WORKFLOW_FIELDS = (
	'http_attempt_count',
	'http_success_count',
	'http_retry_count',
	'http_get_attempt_count',
	'http_post_attempt_count',
	'rate_limit_wait_ms',
	'db_commit_count',
	'db_commit_attempt_count',
	'db_commit_ms'
)


def _milliseconds(seconds):
	return round(max(0, seconds) * 1000, 3)


def request_category(method, url_path):  # pylint: disable=too-many-return-statements,too-many-branches
	"""Returns a low-cardinality category for a Symbol node request path."""

	path = url_path.split('?', 1)[0].lstrip('/')
	if path in ('chain/info', 'network/properties'):
		return 'chain_or_network'
	if path == 'blocks' or path.startswith('blocks/'):
		return 'block'
	if path == 'transactions/confirmed':
		return 'confirmed_transaction'
	if path == 'statements/transaction':
		return 'transaction_statement'
	if path.startswith('statements/resolutions/address'):
		return 'address_resolution'
	if path.startswith('statements/resolutions/mosaic'):
		return 'mosaic_resolution'
	if method == 'POST' and path == 'accounts':
		return 'account_batch'
	if path.startswith('account/') and path.endswith('/multisig'):
		return 'account_multisig'
	if path.startswith('namespaces/'):
		return 'namespace_name' if path.endswith('/names') else 'namespace_detail'
	if method == 'POST' and path == 'mosaics':
		return 'mosaic_batch'
	if path.startswith('mosaics/'):
		return 'mosaic_batch'
	if path == 'metadata':
		return 'metadata_search'
	if path == 'lock/hash' or path.startswith('lock/hash/'):
		return 'hash_lock'
	if path == 'lock/secret':
		return 'secret_lock'
	if path == 'restrictions/mosaic':
		return 'mosaic_restriction'
	return 'other'


class BatchPerformance:  # pylint: disable=too-many-instance-attributes
	"""Collects counters and durations for one internal block batch."""

	def __init__(self, time_source, start_height, end_height):
		self._time_source = time_source
		self._started_at = self._read_time()
		self.start_height = start_height
		self.end_height = end_height
		self.failed_phase = None
		self._phase = None
		self._fields = {field: 0 for field in COUNT_FIELDS + PHASE_FIELDS + DIRTY_FIELDS + DB_FIELDS}
		self._get_attempts_by_category = {category: 0 for category in HTTP_CATEGORIES}
		self._post_attempts_by_category = {category: 0 for category in HTTP_CATEGORIES}

	def _read_time(self):
		try:
			return self._time_source()
		except Exception:  # pylint: disable=broad-exception-caught
			return None

	def _elapsed_seconds(self, started_at):
		ended_at = self._read_time()
		if started_at is None or ended_at is None:
			return 0

		return ended_at - started_at

	@contextmanager
	def measure(self, field, phase):
		"""Measures one phase and preserves the phase name if its body fails."""

		self._phase = phase
		started_at = self._read_time()
		try:
			yield
		finally:
			self._fields[field] += _milliseconds(self._elapsed_seconds(started_at))

	def set_range(self, start_height, end_height):
		"""Sets the actual first and last block heights represented by the batch."""

		self.start_height = start_height
		self.end_height = end_height

	def set_phase(self, phase):
		"""Sets the current non-timed batch phase for failure reporting."""

		self._phase = phase

	def set_count(self, field, value):
		"""Sets an in-memory row or deduplicated-key count."""

		self._fields[field] = value

	def add_count(self, field, value):
		"""Adds rows that were created before a later fetch failure."""

		self._fields[field] += value

	def record_request_attempt(self, method, category):
		"""Records one actual GET or POST node invocation attempt."""

		category = category if category in HTTP_CATEGORIES else 'other'
		self._fields['http_attempt_count'] += 1
		field = 'http_get_attempt_count' if 'GET' == method else 'http_post_attempt_count'
		self._fields[field] += 1
		attempts_by_category = self._get_attempts_by_category if 'GET' == method else self._post_attempts_by_category
		attempts_by_category[category] += 1

	def record_request_success(self):
		"""Records one node invocation that returned a non-error response."""

		self._fields['http_success_count'] += 1

	def record_retry(self):
		"""Records one retry after an initial failed node invocation."""

		self._fields['http_retry_count'] += 1

	def record_rate_limit_wait(self, wait_seconds):
		"""Adds one RequestRateLimiter wait duration in seconds."""

		self._fields['rate_limit_wait_ms'] += _milliseconds(wait_seconds)

	def record_commit(self, elapsed_seconds, succeeded):
		"""Records one actual commit attempt and its result."""

		self._fields['db_commit_attempt_count'] += 1
		self._fields['db_commit_ms'] += _milliseconds(elapsed_seconds)
		if succeeded:
			self._fields['db_commit_count'] += 1

	def set_failed_phase(self):
		"""Captures the phase active when the batch failed."""

		self.failed_phase = self._phase

	def event(self, event_name, status, exception=None):
		"""Builds a JSON-serializable structured event mapping."""

		fields = {
			'event': event_name,
			'status': status,
			'start_height': self.start_height,
			'end_height': self.end_height,
			'elapsed_ms': _milliseconds(self._elapsed_seconds(self._started_at)),
			'failed_phase': self.failed_phase,
			'exception_class': type(exception).__name__ if exception is not None else None,
			'http_get_attempts_by_category': dict(self._get_attempts_by_category),
			'http_post_attempts_by_category': dict(self._post_attempts_by_category),
		}
		fields.update(self._fields)
		return fields


class SyncPerformance:  # pylint: disable=too-many-instance-attributes
	"""Owns performance state for exactly one ``sync-block`` execution."""

	def __init__(self, time_source):
		self._time_source = time_source
		self._started_at = self._read_time()
		self.start_height = None
		self.target_height = None
		self.last_completed_height = None
		self._phase = None
		self.failed_phase = None
		self._batches = []
		self._active_batch = None
		self._workflow_counters = BatchPerformance(time_source, None, None)

	def _read_time(self):
		try:
			return self._time_source()
		except Exception:  # pylint: disable=broad-exception-caught
			return None

	def _elapsed_seconds(self):
		ended_at = self._read_time()
		if self._started_at is None or ended_at is None:
			return 0

		return ended_at - self._started_at

	def set_bounds(self, start_height, target_height):
		"""Sets the requested synchronization range."""

		self.start_height = start_height
		self.target_height = target_height

	def set_phase(self, phase):
		"""Sets the current workflow phase used when a non-batch operation fails."""

		self._phase = phase

	def set_failed_phase(self):
		"""Captures the current workflow phase after a workflow failure."""

		if self.failed_phase is None:
			self.failed_phase = self._phase

	def set_last_completed_height(self, height):
		"""Sets the last persisted height when no new internal batch was needed."""

		self.last_completed_height = height

	def start_batch(self, start_height, end_height):
		"""Starts and activates one internal block batch."""

		batch = BatchPerformance(self._time_source, start_height, end_height)
		self._batches.append(batch)
		self._active_batch = batch
		return batch

	def complete_batch(self, batch):
		"""Marks one batch complete and advances the last completed height."""

		self.last_completed_height = batch.end_height
		self._active_batch = None

	def fail_batch(self, batch):
		"""Captures a failed batch while preserving partial counters."""

		batch.set_failed_phase()
		self.failed_phase = batch.failed_phase
		self._active_batch = None

	def record_request_attempt(self, method, category):
		"""Records an HTTP attempt for the workflow and active batch."""

		self._workflow_counters.record_request_attempt(method, category)
		if self._active_batch is not None:
			self._active_batch.record_request_attempt(method, category)

	def add_count(self, field, value):
		"""Adds partial in-memory rows to the active batch, if one exists."""

		if self._active_batch is not None:
			self._active_batch.add_count(field, value)

	def record_request_success(self):
		"""Records an HTTP success for the workflow and active batch."""

		self._workflow_counters.record_request_success()
		if self._active_batch is not None:
			self._active_batch.record_request_success()

	def record_retry(self):
		"""Records an HTTP retry for the workflow and active batch."""

		self._workflow_counters.record_retry()
		if self._active_batch is not None:
			self._active_batch.record_retry()

	def record_rate_limit_wait(self, wait_seconds):
		"""Records rate-limiter wait time for the workflow and active batch."""

		self._workflow_counters.record_rate_limit_wait(wait_seconds)
		if self._active_batch is not None:
			self._active_batch.record_rate_limit_wait(wait_seconds)

	def record_commit(self, elapsed_seconds, succeeded):
		"""Records a database commit for the workflow and active batch."""

		self._workflow_counters.record_commit(elapsed_seconds, succeeded)
		if self._active_batch is not None:
			self._active_batch.record_commit(elapsed_seconds, succeeded)

	def _aggregate(self):
		fields = {field: 0 for field in COUNT_FIELDS + PHASE_FIELDS + DIRTY_FIELDS + DB_FIELDS}
		for batch in self._batches:
			event = batch.event('', '')
			for field in fields:
				if field not in WORKFLOW_FIELDS:
					fields[field] += event[field]

		workflow_event = self._workflow_counters.event('', '')
		for field in WORKFLOW_FIELDS:
			fields[field] = workflow_event[field]

		return fields, workflow_event['http_get_attempts_by_category'], workflow_event['http_post_attempts_by_category']

	def event(self, event_name, status, exception=None):
		"""Builds a structured workflow completion or failure event mapping."""

		fields, get_attempts_by_category, post_attempts_by_category = self._aggregate()
		return {
			'event': event_name,
			'status': status,
			'start_height': self.start_height,
			'target_height': self.target_height,
			'last_completed_height': self.last_completed_height,
			'elapsed_ms': _milliseconds(self._elapsed_seconds()),
			'batch_count': len(self._batches),
			'failed_phase': self.failed_phase,
			'exception_class': type(exception).__name__ if exception is not None else None,
			'http_get_attempts_by_category': get_attempts_by_category,
			'http_post_attempts_by_category': post_attempts_by_category,
			**fields
		}
