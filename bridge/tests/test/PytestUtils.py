class PytestAsserter:
	"""Adapter for mapping unittest-style asserts to pytest asserts."""

	@staticmethod
	def assertEqual(expected, actual):  # pylint: disable=invalid-name
		assert expected == actual
