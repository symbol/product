from datetime import datetime, timezone
from unittest import TestCase

from symbolchain.symbol.Network import Address

from rest.model.symbol.Namespace import SymbolNamespaceView

OWNER_ADDRESS = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')
ALIAS_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')


class SymbolNamespaceViewTest(TestCase):
	@staticmethod
	def _create_view(**overrides):
		values = {
			'namespace_id': 'a95f1f8a96159516',
			'full_name': 'foo.bar',
			'levels': [
				{'name': 'foo', 'namespaceId': 'A95F1F8A96159516', 'parentId': None},
				{'name': 'bar', 'namespaceId': 'E74B99BA41F4AFEE', 'parentId': 'A95F1F8A96159516'}
			],
			'alias_type': 'address',
			'alias_mosaic_id': None,
			'alias_address': str(Address(ALIAS_ADDRESS)),
			'owner_address': str(Address(OWNER_ADDRESS)),
			'start_height': 12,
			'start_timestamp': datetime(2026, 1, 2, 3, 4, 5, 987654, tzinfo=timezone.utc),
			'registration_type': 'child',
			'end_height': 99,
			'sub_namespace_count': 2
		}
		values.update(overrides)
		return SymbolNamespaceView(**values)

	def test_formats_full_namespace_item(self):
		# Arrange:
		view = self._create_view()

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual({
			'id': 'A95F1F8A96159516',
			'name': 'A95F1F8A96159516',
			'namespaceName': 'foo.bar',
			'namespaceLevels': [
				{'name': 'foo', 'namespaceId': 'A95F1F8A96159516', 'parentId': None},
				{'name': 'bar', 'namespaceId': 'E74B99BA41F4AFEE', 'parentId': 'A95F1F8A96159516'}
			],
			'aliasType': 'address',
			'aliasMosaicId': None,
			'aliasAddress': str(Address(ALIAS_ADDRESS)),
			'creator': str(Address(OWNER_ADDRESS)),
			'registrationHeight': 12,
			'startTimestamp': '2026-01-02 03:04:05',
			'registrationType': 'child',
			'expirationHeight': 99,
			'isUnlimitedDuration': False,
			'subNamespaceCount': 2
		}, result)

	def test_formats_mosaic_alias_and_fallback_name(self):
		# Arrange:
		view = self._create_view(
			namespace_id='E74B99BA41F4AFEE',
			full_name=None,
			levels=[{'name': 'E74B99BA41F4AFEE', 'namespaceId': 'E74B99BA41F4AFEE', 'parentId': None}],
			alias_type='mosaic',
			alias_mosaic_id='72c0212e67a08bce',
			alias_address=None,
			registration_type='root',
			end_height=None,
			sub_namespace_count=0)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual('E74B99BA41F4AFEE', result['name'])
		self.assertEqual('E74B99BA41F4AFEE', result['namespaceName'])
		self.assertEqual('72C0212E67A08BCE', result['aliasMosaicId'])
		self.assertIsNone(result['aliasAddress'])
		self.assertIsNone(result['expirationHeight'])
		self.assertIs(True, result['isUnlimitedDuration'])

	def test_formats_missing_block_timestamp_as_null(self):
		# Arrange:
		view = self._create_view(start_timestamp=None)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertIsNone(result['startTimestamp'])
