import datetime

from prometheus_client import Gauge

from ...db.Databases import Databases
from ...WorkflowUtils import is_daily_limit_exceeded


class WrapRequestCollector:
	"""Collects the state of bridge requests from the databases on the bridge host."""

	def __init__(self, context):
		"""Creates a wrap request collector."""

		self.context = context

	async def collect(self, registry):
		"""Adds request metrics to the registry."""

		failed_gauge = Gauge(
			'bridge_requests_failed_permanent',
			'requests that failed and were not retried; each one is potentially lost user funds',
			['direction'],
			registry=registry)
		retries_gauge = Gauge(
			'bridge_request_retries',
			'transient failures that were put back into circulation; one per attempt, not per request',
			['direction'],
			registry=registry)
		rejected_gauge = Gauge(
			'bridge_requests_rejected',
			'deposits that were rejected on download and never became requests',
			['direction'],
			registry=registry)
		remaining_gauge = Gauge(
			'bridge_daily_transfer_remaining',
			'gross amount that can still be paid out within the rolling 24 hour limit',
			['direction'],
			registry=registry)
		unprocessed_age_gauge = Gauge(
			'bridge_oldest_unprocessed_age_seconds',
			'age of the oldest request that has not been processed yet',
			['direction'],
			registry=registry)
		sent_age_gauge = Gauge(
			'bridge_oldest_sent_age_seconds',
			'age of the oldest payout that has not been confirmed yet',
			['direction'],
			registry=registry)

		now = datetime.datetime.now(datetime.timezone.utc).timestamp()

		with Databases(*self.context.database_params) as databases:
			# the daily limit belongs to the network the payout is made on: wrapping pays out on the wrapped
			# network and unwrapping on the native one
			direction_database_facade_tuples = (
				('wrap', databases.wrap_request, self.context.wrapped_facade),
				('unwrap', databases.unwrap_request, self.context.native_facade)
			)
			for (direction, database, payout_facade) in direction_database_facade_tuples:
				failed_gauge.labels(direction).set(database.count_permanent_failures())
				retries_gauge.labels(direction).set(database.count_retries())
				rejected_gauge.labels(direction).set(database.count_rejected_requests())
				_set_daily_transfer_remaining(remaining_gauge, direction, payout_facade, database)
				_set_age(unprocessed_age_gauge, direction, now, database.oldest_unprocessed_request_timestamp())
				_set_age(sent_age_gauge, direction, now, database.oldest_payout_sent_timestamp())


def _set_age(gauge, direction, now, timestamp):
	if timestamp is not None:
		gauge.labels(direction).set(now - timestamp)


def _set_daily_transfer_remaining(gauge, direction, payout_facade, database):
	# a bridge without a configured limit has nothing remaining to report
	if not int(payout_facade.config.extensions.get('max_daily_transfer_amount', 0)):
		return

	(_, amount_remaining) = is_daily_limit_exceeded(payout_facade, database, 0)
	gauge.labels(direction).set(amount_remaining)
