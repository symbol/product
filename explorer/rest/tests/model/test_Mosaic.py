import unittest

from rest.model.Mosaic import MosaicRichListView, MosaicView


class MosaicTest(unittest.TestCase):
	@staticmethod
	def _create_default_mosaic_view(override=None):
		mosaic_view = MosaicView(
			namespace_name='nem.xem',
			description='network currency',
			creator='TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			mosaic_registered_height=1,
			mosaic_registered_timestamp='2015-03-29 00:06:25',
			initial_supply=8999999999000000,
			total_supply=8999999999000000,
			divisibility=6,
			supply_mutable=False,
			transferable=True,
			levy_type=None,
			levy_namespace_name=None,
			levy_fee=None,
			levy_recipient=None,
			root_namespace_registered_height=1,
			root_namespace_registered_timestamp='2015-03-29 00:06:25',
			root_namespace_expiration_height=525700
		)

		if override:
			setattr(mosaic_view, override[0], override[1])

		return mosaic_view

	def test_can_create_mosaic_view(self):
		# Act:
		mosaic_view = self._create_default_mosaic_view()

		# Assert:
		self.assertEqual('nem.xem', mosaic_view.namespace_name)
		self.assertEqual('network currency', mosaic_view.description)
		self.assertEqual('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I', mosaic_view.creator)
		self.assertEqual(1, mosaic_view.mosaic_registered_height)
		self.assertEqual('2015-03-29 00:06:25', mosaic_view.mosaic_registered_timestamp)
		self.assertEqual(8999999999000000, mosaic_view.initial_supply)
		self.assertEqual(8999999999000000, mosaic_view.total_supply)
		self.assertEqual(6, mosaic_view.divisibility)
		self.assertEqual(False, mosaic_view.supply_mutable)
		self.assertEqual(True, mosaic_view.transferable)
		self.assertEqual(None, mosaic_view.levy_type)
		self.assertEqual(None, mosaic_view.levy_namespace_name)
		self.assertEqual(None, mosaic_view.levy_fee)
		self.assertEqual(None, mosaic_view.levy_recipient)
		self.assertEqual(1, mosaic_view.root_namespace_registered_height)
		self.assertEqual('2015-03-29 00:06:25', mosaic_view.root_namespace_registered_timestamp)
		self.assertEqual(525700, mosaic_view.root_namespace_expiration_height)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_view()

		# Act:
		mosaic_view_dict = mosaic_view.to_dict()

		# Assert:
		self.assertEqual({
			'namespaceName': 'nem.xem',
			'description': 'network currency',
			'creator': 'TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			'mosaicRegisteredHeight': 1,
			'mosaicRegisteredTimestamp': '2015-03-29 00:06:25',
			'initialSupply': 8999999999000000,
			'totalSupply': 8999999999000000,
			'divisibility': 6,
			'supplyMutable': False,
			'transferable': True,
			'levyType': None,
			'levyNamespaceName': None,
			'levyFee': None,
			'levyRecipient': None,
			'rootNamespaceRegisteredHeight': 1,
			'rootNamespaceRegisteredTimestamp': '2015-03-29 00:06:25',
			'rootNamespaceExpirationHeight': 525700
		}, mosaic_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		mosaic_view = self._create_default_mosaic_view()

		# Assert:
		self.assertEqual(mosaic_view, self._create_default_mosaic_view())
		self.assertNotEqual(mosaic_view, None)
		self.assertNotEqual(mosaic_view, 'mosaic_view')
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('namespace_name', 'foo.bar')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('description', 'updated description')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('creator', 'TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('mosaic_registered_height', 2)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('mosaic_registered_timestamp', '2015-03-29 20:34:19')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('initial_supply', 1000)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('total_supply', 2000)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('divisibility', 0)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('supply_mutable', True)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('transferable', False)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_type', 'absolute fee')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_namespace_name', 'nem.other')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_fee', 10)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('levy_recipient', 'TBQWEXAMPLEADDRESS')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_registered_height', 2)))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_registered_timestamp', '2015-03-29 20:34:19')))
		self.assertNotEqual(mosaic_view, self._create_default_mosaic_view(('root_namespace_expiration_height', 525701)))


class MosaicRichListTest(unittest.TestCase):
	@staticmethod
	def _create_default_mosaic_rich_list_view(override=None):
		mosaic_rich_list_view = MosaicRichListView(
			address='TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			remark='Test remark',
			balance=1000
		)

		if override:
			setattr(mosaic_rich_list_view, override[0], override[1])

		return mosaic_rich_list_view

	def test_can_create_mosaic_rich_list_view(self):
		# Act:
		mosaic_rich_list_view = self._create_default_mosaic_rich_list_view()

		# Assert:
		self.assertEqual('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I', mosaic_rich_list_view.address)
		self.assertEqual('Test remark', mosaic_rich_list_view.remark)
		self.assertEqual(1000, mosaic_rich_list_view.balance)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		mosaic_rich_list_view = self._create_default_mosaic_rich_list_view()

		# Act:
		mosaic_rich_list_view_dict = mosaic_rich_list_view.to_dict()

		# Assert:
		self.assertEqual({
			'address': 'TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			'remark': 'Test remark',
			'balance': 1000
		}, mosaic_rich_list_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		mosaic_rich_list_view = self._create_default_mosaic_rich_list_view()

		# Assert:
		self.assertEqual(mosaic_rich_list_view, self._create_default_mosaic_rich_list_view())
		self.assertNotEqual(mosaic_rich_list_view, None)
		self.assertNotEqual(mosaic_rich_list_view, 'mosaic_rich_list_view')
		self.assertNotEqual(mosaic_rich_list_view, self._create_default_mosaic_rich_list_view(('address', 'ABC')))
		self.assertNotEqual(mosaic_rich_list_view, self._create_default_mosaic_rich_list_view(('remark', 'Updated remark')))
		self.assertNotEqual(mosaic_rich_list_view, self._create_default_mosaic_rich_list_view(('balance', 2000)))
