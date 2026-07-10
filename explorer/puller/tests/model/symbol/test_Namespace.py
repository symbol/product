from unittest import TestCase

from symbolchain.symbol.Network import Network

from puller.model.symbol.Namespace import create_alias_name_rows, create_namespace_row
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	create_expected_root_namespace_row,
	create_namespace_item
)
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS

ROOT_ID = NAMESPACE_ROOT_ID
SUB_ID = NAMESPACE_SUB_ID
ALIAS_ADDRESS = '9899432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'


class NamespaceTest(TestCase):
	def test_create_namespace_row_normalizes_root_namespace_with_unlimited_duration(self):
		# Arrange:
		item = create_namespace_item()

		# Act:
		row = create_namespace_row(item, {ROOT_ID: 'root'}, 123)

		# Assert:
		self.assertEqual(create_expected_root_namespace_row(ROOT_ID, 'root', BENEFICIARY_ADDRESS, item, 123), row)

	def test_create_namespace_row_normalizes_sub_namespace_and_mosaic_alias(self):
		# Arrange:
		item = create_namespace_item(
			namespace_id=SUB_ID,
			root_id=ROOT_ID,
			parent_id=ROOT_ID,
			alias={'type': 1, 'mosaicId': '72C0212E67A08BCE'},
			endHeight='456')

		# Act:
		row = create_namespace_row(item, {ROOT_ID: 'root', SUB_ID: 'sub'}, 123)

		# Assert:
		self.assertEqual({
			'namespace_id': SUB_ID,
			'parent_id': ROOT_ID,
			'root_id': ROOT_ID,
			'name': 'sub',
			'full_name': 'root.sub',
			'depth': 2,
			'registration_type': 1,
			'owner_address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'start_height': 1,
			'end_height': 456,
			'alias_type': 1,
			'alias_mosaic_id': '72C0212E67A08BCE',
			'alias_address': None,
			'raw_payload': item,
			'updated_at_height': 123
		}, row)

	def test_create_namespace_row_normalizes_address_alias(self):
		# Arrange:
		item = create_namespace_item(alias={'type': 2, 'address': ALIAS_ADDRESS})

		# Act:
		row = create_namespace_row(item, {ROOT_ID: 'root'}, 123)

		# Assert:
		expected_row = create_expected_root_namespace_row(ROOT_ID, 'root', BENEFICIARY_ADDRESS, item, 123)
		self.assertEqual({
			**expected_row,
			'alias_type': 2,
			'alias_address': bytes.fromhex(ALIAS_ADDRESS)
		}, row)

	def test_create_namespace_row_raises_when_a_level_name_is_missing(self):
		# Arrange:
		item = create_namespace_item(namespace_id=SUB_ID, root_id=ROOT_ID, parent_id=ROOT_ID)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Missing namespace level name'):
			create_namespace_row(item, {ROOT_ID: 'root'}, 123)

	def test_create_alias_name_rows_returns_only_namespace_name_when_alias_is_none(self):
		# Arrange:
		row = create_namespace_row(create_namespace_item(), {ROOT_ID: 'root'}, 123)

		# Act:
		alias_rows = create_alias_name_rows(row, Network.TESTNET)

		# Assert:
		self.assertEqual([{
			'artifact_type': 'namespace',
			'artifact_id': ROOT_ID,
			'name': 'root',
			'updated_at_height': 123
		}], alias_rows)

	def test_create_alias_name_rows_adds_mosaic_name_when_namespace_aliases_mosaic(self):
		# Arrange:
		row = create_namespace_row(
			create_namespace_item(alias={'type': 1, 'mosaicId': '72C0212E67A08BCE'}),
			{ROOT_ID: 'root'},
			123)

		# Act:
		alias_rows = create_alias_name_rows(row, Network.TESTNET)

		# Assert:
		self.assertEqual([
			{'artifact_type': 'namespace', 'artifact_id': ROOT_ID, 'name': 'root', 'updated_at_height': 123},
			{'artifact_type': 'mosaic', 'artifact_id': '72C0212E67A08BCE', 'name': 'root', 'updated_at_height': 123}
		], alias_rows)

	def test_create_alias_name_rows_adds_address_text_when_namespace_aliases_account(self):
		# Arrange:
		row = create_namespace_row(
			create_namespace_item(alias={'type': 2, 'address': ALIAS_ADDRESS}),
			{ROOT_ID: 'root'},
			123)

		# Act:
		alias_rows = create_alias_name_rows(row, Network.TESTNET)

		# Assert:
		self.assertEqual([
			{'artifact_type': 'namespace', 'artifact_id': ROOT_ID, 'name': 'root', 'updated_at_height': 123},
			{
				'artifact_type': 'account',
				'artifact_id': 'TCMUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				'name': 'root',
				'updated_at_height': 123
			}
		], alias_rows)
