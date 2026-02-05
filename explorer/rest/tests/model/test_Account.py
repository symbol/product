import unittest

from rest.model.Account import AccountView


class AccountTest(unittest.TestCase):
	@staticmethod
	def _create_default_account_view(override=None):
		account_view = AccountView(
			address='NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT',
			public_key='107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7',
			remote_address='NA7HZVREMOJWCYQOHQYTMVVXOYFOFF4WX46FP65U',
			importance=0.0477896226,
			balance=1000.123456,
			vested_balance=999.123456,
			mosaics=[],
			harvested_fees=1234.567890,
			harvested_blocks=100,
			status='LOCKED',
			remote_status='ACTIVE',
			last_harvested_height=1000,
			min_cosignatories=None,
			cosignatory_of=[],
			cosignatories=[]
		)

		if override:
			setattr(account_view, override[0], override[1])

		return account_view

	def test_can_create_account_view(self):
		# Act:
		account_view = self._create_default_account_view()

		# Assert:
		self.assertEqual('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT', account_view.address)
		self.assertEqual('107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7', account_view.public_key)
		self.assertEqual('NA7HZVREMOJWCYQOHQYTMVVXOYFOFF4WX46FP65U', account_view.remote_address)
		self.assertEqual(0.0477896226, account_view.importance)
		self.assertEqual(1000.123456, account_view.balance)
		self.assertEqual(999.123456, account_view.vested_balance)
		self.assertEqual([], account_view.mosaics)
		self.assertEqual(1234.567890, account_view.harvested_fees)
		self.assertEqual(100, account_view.harvested_blocks)
		self.assertEqual('LOCKED', account_view.status)
		self.assertEqual('ACTIVE', account_view.remote_status)
		self.assertEqual(1000, account_view.last_harvested_height)
		self.assertIsNone(account_view.min_cosignatories)
		self.assertEqual([], account_view.cosignatory_of)
		self.assertEqual([], account_view.cosignatories)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		account_view = self._create_default_account_view()

		# Act:
		account_view_dict = account_view.to_dict()

		# Assert:
		self.assertEqual({
			'address': 'NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT',
			'publicKey': '107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7',
			'remoteAddress': 'NA7HZVREMOJWCYQOHQYTMVVXOYFOFF4WX46FP65U',
			'importance': 0.0477896226,
			'balance': 1000.123456,
			'vestedBalance': 999.123456,
			'mosaics': [],
			'harvestedFees': 1234.567890,
			'harvestedBlocks': 100,
			'status': 'LOCKED',
			'remoteStatus': 'ACTIVE',
			'lastHarvestedHeight': 1000,
			'minCosignatories': None,
			'cosignatoryOf': [],
			'cosignatories': []
		}, account_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		account_view = self._create_default_account_view()

		# Assert:
		self.assertEqual(account_view, self._create_default_account_view())
		self.assertNotEqual(account_view, None)
		self.assertNotEqual(account_view, 'account_view')
		self.assertNotEqual(account_view, self._create_default_account_view(('address', 'DIFFERENT_ADDRESS')))
		self.assertNotEqual(account_view, self._create_default_account_view(('public_key', 'DIFFERENT_KEY')))
		self.assertNotEqual(account_view, self._create_default_account_view(('remote_address', 'DIFFERENT_REMOTE')))
		self.assertNotEqual(account_view, self._create_default_account_view(('importance', 0.002)))
		self.assertNotEqual(account_view, self._create_default_account_view(('balance', 999999.0)))
		self.assertNotEqual(account_view, self._create_default_account_view(('vested_balance', 888888.0)))
		self.assertNotEqual(account_view, self._create_default_account_view(('mosaics', [{'id': 'test'}])))
		self.assertNotEqual(account_view, self._create_default_account_view(('harvested_fees', 5000.0)))
		self.assertNotEqual(account_view, self._create_default_account_view(('harvested_blocks', 99999)))
		self.assertNotEqual(account_view, self._create_default_account_view(('status', 'UNLOCKED')))
		self.assertNotEqual(account_view, self._create_default_account_view(('remote_status', 'INACTIVE')))
		self.assertNotEqual(account_view, self._create_default_account_view(('last_harvested_height', 500000)))
		self.assertNotEqual(account_view, self._create_default_account_view(('min_cosignatories', 2)))
		self.assertNotEqual(account_view, self._create_default_account_view(('cosignatory_of', ['ADDRESS1'])))
		self.assertNotEqual(account_view, self._create_default_account_view(('cosignatories', ['ADDRESS2'])))
