import unittest

from symbolchain.nem.Network import Address

from rest.model.Mosaic import MosaicView


class MosaicTest(unittest.TestCase):
	@staticmethod
	def _create_default_mosaic_view(override=None):
		mosaic_view = MosaicView(
			'dragonfly',
			'dragon',
			'sample information',
			Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
			2,
			'2015-03-29 20:34:19',
			100,
			100,
			0,
			False,
			True,
			'percentile',
			'nem.xem',
			150000,
			Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
			2,
			'2015-03-29 20:34:19',
			525602
		)

		if override:
			setattr(mosaic_view, override[0], override[1])

		return mosaic_view

	def test_can_create_mosaic_view(self):
		# Act:
		mosaic_view = self._create_default_mosaic_view()

		# Assert:
		self.assertEqual('dragonfly', mosaic_view.mosaic_name)
		self.assertEqual('dragon', mosaic_view.namespace_name)
		self.assertEqual('sample information', mosaic_view.description)
		self.assertEqual(Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'), mosaic_view.creator)
		self.assertEqual(2, mosaic_view.registered_height)
		self.assertEqual('2015-03-29 20:34:19', mosaic_view.registered_timestamp)
		self.assertEqual(100, mosaic_view.initial_supply)
		self.assertEqual(100, mosaic_view.total_supply)
		self.assertEqual(0, mosaic_view.divisibility)
		self.assertEqual(False, mosaic_view.supply_mutable)
		self.assertEqual(True, mosaic_view.transferable)
		self.assertEqual('percentile', mosaic_view.levy_type)
		self.assertEqual('nem.xem', mosaic_view.levy_namespace)
		self.assertEqual(150000, mosaic_view.levy_fee)
		self.assertEqual(Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'), mosaic_view.levy_recipient)
		self.assertEqual(2, mosaic_view.root_namespace_registered_height)
		self.assertEqual('2015-03-29 20:34:19', mosaic_view.root_namespace_registered_timestamp)
		self.assertEqual(525602, mosaic_view.root_namespace_expiration_height)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_view()

		# Act:
		mosaic_view_dict = mosaic_view.to_dict()

		# Assert:
		self.assertEqual({
			'mosaicName': 'dragonfly',
			'namespaceName': 'dragon',
			'description': 'sample information',
			'creator': 'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3',
			'registeredHeight': 2,
			'registeredTimestamp': '2015-03-29 20:34:19',
			'initialSupply': 100,
			'totalSupply': 100,
			'divisibility': 0,
			'supplyMutable': False,
			'transferable': True,
			'levyType': 'percentile',
			'levyNamespace': 'nem.xem',
			'levyFee': 150000,
			'levyRecipient': 'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3',
			'rootNamespaceRegisteredHeight': 2,
			'rootNamespaceRegisteredTimestamp': '2015-03-29 20:34:19',
			'rootNamespaceExpirationHeight': 525602
		}, mosaic_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_view()

		# Assert:
		self.assertEqual(mosaic_view, self._create_default_mosaic_view())
		self.assertNotEqual(mosaic_view, None)
		self.assertNotEqual(mosaic_view, 'mosaic_view')
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('mosaic_name', 'xem')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('namespace_name', 'nem')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('description', 'no description')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('creator', 'random creator')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('registered_height', 10)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('registered_timestamp', 'random timestamp')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('initial_supply', 99)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('total_supply', 99)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('divisibility', 6)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('supply_mutable', True)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('transferable', False)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_type', None)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_namespace', None)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_fee', None)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_recipient', None)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_registered_height', 4)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_registered_timestamp', 'random timestamp')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_expiration_height', 10)))
