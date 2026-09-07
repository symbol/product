import datetime

from prometheus_client import Gauge

from ...db.Databases import Databases
from ...WorkflowUtils import is_daily_limit_exceeded


class WrapRequestGauges:
	"""Gauges published for one scrape, created together so that collecting them stays readable."""

	def __init__(self, registry):
		"""Creates and registers every request gauge."""

		self.failed = Gauge(
			'bridge_requests_failed_permanent',
			'requests that failed and were not retried; each one is potentially lost user funds',
			['direction'],
			registry=registry)
		self.retries = Gauge(
			'bridge_request_retries',
			'transient failures that were put back into circulation; one per attempt, not per request',
			['direction'],
			registry=registry)
		self.rejected = Gauge(
			'bridge_requests_rejected',
			'deposits that were rejected on download and never became requests',
			['direction'],
			registry=registry)
		self.daily_transfer_remaining = Gauge(
			'bridge_daily_transfer_remaining',
			'gross amount that can still be paid out within the rolling 24 hour limit',
			['direction'],
			registry=registry)
		self.unprocessed_age = Gauge(
			'bridge_oldest_unprocessed_age_seconds',
			'age of the oldest request that has not been processed yet',
			['direction'],
			registry=registry)
		self.sent_age = Gauge(
			'bridge_oldest_sent_age_seconds',
			'age of the oldest payout that has not been confirmed yet',
			['direction'],
			registry=registry)
		self.processed_height = Gauge(
			'bridge_processed_height',
			'height of the newest block the bridge has downloaded requests from',
			['network'],
			registry=registry)


class WrapRequestCollector:
	"""Collects the state of bridge requests from the databases on the bridge host."""

	def __init__(self, context):
		"""Creates a wrap request collector."""

		self.context = context

	async def collect(self, registry):
		"""Adds request metrics to the registry."""

		gauges = WrapRequestGauges(registry)
		now = datetime.datetime.now(datetime.timezone.utc).timestamp()

		with Databases(*self.context.database_params) as databases:
			# requests are downloaded from the network opposite the one they are paid out on: wrapping
			# reads deposits from the native network and pays out on the wrapped one, unwrapping the
			# other way around. the daily limit belongs to the payout network, the processed height to
			# the network the requests were read from
			direction_database_facade_tuples = (
				('wrap', databases.wrap_request, self.context.wrapped_facade, 'native'),
				('unwrap', databases.unwrap_request, self.context.native_facade, 'wrapped')
			)
			for (direction, database, payout_facade, request_network) in direction_database_facade_tuples:
				gauges.failed.labels(direction).set(database.count_permanent_failures())
				gauges.retries.labels(direction).set(database.count_retries())
				gauges.rejected.labels(direction).set(database.count_rejected_requests())
				_set_daily_transfer_remaining(gauges.daily_transfer_remaining, direction, payout_facade, database)
				_set_age(gauges.unprocessed_age, direction, now, database.oldest_unprocessed_request_timestamp())
				_set_age(gauges.sent_age, direction, now, database.oldest_payout_sent_timestamp())
				gauges.processed_height.labels(request_network).set(database.max_processed_height())


def _set_age(gauge, direction, now, timestamp):
	if timestamp is not None:
		gauge.labels(direction).set(now - timestamp)


def _set_daily_transfer_remaining(gauge, direction, payout_facade, database):
	# a bridge without a configured limit has nothing remaining to report
	if not int(payout_facade.config.extensions.get('max_daily_transfer_amount', 0)):
		return

	(_, amount_remaining) = is_daily_limit_exceeded(payout_facade, database, 0)
	gauge.labels(direction).set(amount_remaining)
