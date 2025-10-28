import datetime
import logging


async def make_throttled_conversion_rate_lookup(price_oracle, refresh_rate_seconds, ticker1, ticker2):  # pylint: disable=invalid-name
	"""Creates a throttled conversion rate lookup function."""

	logger = logging.getLogger(__name__)

	class Throttle:
		def __init__(self):
			self.conversion_rate = None
			self.last_lookup_time = None

		async def lookup(self):
			now = datetime.datetime.now()

			if self.last_lookup_time:
				if (now - self.last_lookup_time).total_seconds() < refresh_rate_seconds:
					return self.conversion_rate

			self.conversion_rate = await price_oracle.conversion_rate(ticker1, ticker2)
			self.last_lookup_time = now

			logger.debug('refreshed conversion rate at %s, new value = %.8f', self.last_lookup_time, self.conversion_rate)

			return self.conversion_rate

	return Throttle().lookup
