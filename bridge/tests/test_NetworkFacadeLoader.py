import unittest

from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkFacadeLoader import load_network_facade


class NetworkFacadeLoader(unittest.TestCase):
	def test_can_load_nem_network_facade(self):
		# Act:
		facade = load_network_facade('nem', 'testnet')

		# Assert:
		self.assertIsInstance(facade, NemNetworkFacade)
		self.assertEqual('testnet', facade.network.name)

	def test_cannot_load_unknown_network_facade(self):
		with self.assertRaisesRegex(ValueError, 'blockchain "foo" is unsupported'):
			load_network_facade('foo', 'testnet')
