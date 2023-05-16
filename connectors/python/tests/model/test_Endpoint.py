import unittest

from symbolconnectors.model.Endpoint import Endpoint


class EndpointTest(unittest.TestCase):
	@staticmethod
	def _create_default_endpoint(override=None):
		endpoint = Endpoint('http', 'mysymbolnode.com', 3000)

		if override:
			setattr(endpoint, override[0], override[1])

		return endpoint

	def test_can_create_endpoint(self):
		# Act:
		endpoint = self._create_default_endpoint()

		# Assert:
		self.assertEqual('http', endpoint.protocol)
		self.assertEqual('mysymbolnode.com', endpoint.host)
		self.assertEqual(3000, endpoint.port)

	def test_eq_is_supported(self):
		# Arrange:
		endpoint = self._create_default_endpoint()

		# Act + Assert:
		self.assertEqual(endpoint, self._create_default_endpoint())
		self.assertNotEqual(endpoint, None)
		self.assertNotEqual(endpoint, 17)
		self.assertNotEqual(endpoint, self._create_default_endpoint(('protocol', 'https')))
		self.assertNotEqual(endpoint, self._create_default_endpoint(('host', 'mysymbolnode.net')))
		self.assertNotEqual(endpoint, self._create_default_endpoint(('port', 3001)))

	def test_str_is_supported(self):
		# Arrange:
		endpoint = self._create_default_endpoint()

		# Act:
		endpoint_str = str(endpoint)

		# Assert:
		self.assertEqual('http://mysymbolnode.com:3000', endpoint_str)

	def test_repr_is_supported(self):
		# Arrange:
		endpoint = self._create_default_endpoint()

		# Act:
		endpoint_repr = repr(endpoint)
		endpoint2 = eval(endpoint_repr)  # pylint: disable=eval-used

		# Assert:
		self.assertEqual('Endpoint(\'http\', \'mysymbolnode.com\', 3000)', endpoint_repr)
		self.assertEqual(endpoint, endpoint2)
