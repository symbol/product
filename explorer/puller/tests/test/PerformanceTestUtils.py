class FailingClock:
	"""Clock fake that raises when its value is requested."""

	def __call__(self):  # pylint: disable=no-self-use
		raise RuntimeError('clock failed')


class ScriptedClock:
	"""Clock fake that returns or raises each scripted value in order."""

	def __init__(self, values):
		self._values = iter(values)
		self.call_count = 0

	def __call__(self):
		self.call_count += 1
		try:
			value = next(self._values)
		except StopIteration as exception:
			raise AssertionError('clock value sequence was exhausted') from exception

		if isinstance(value, Exception):
			raise value

		return value
