import re
from datetime import datetime, timezone
from unittest import TestCase

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabase import NamespaceQuery, SortOrder, SymbolDatabase, SymbolDataInvalid, SymbolDataUnavailable

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database
from ..test.SymbolNamespaceTestUtils import DEFAULT_NAMESPACE_OWNER as OWNER
from ..test.SymbolNamespaceTestUtils import (
	call_with_timeout,
	create_ancestor_cycle_namespaces,
	create_namespace_descendant_rows,
	create_namespace_root_child_rows,
	create_namespace_sibling_rows,
	create_symbol_namespace,
	expected_symbol_namespace_child_dto
)

_namespace = create_symbol_namespace

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
OTHER_OWNER = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
ROOT_ID = 'A95F1F8A96159516'
CHILD_ID = 'E74B99BA41F4AFEE'
LEAF_ID = 'C74B99BA41F4AFEE'
OTHER_ROOT_ID = 'D95F1F8A96159516'


def _blocks(*heights):
	return [create_symbol_block(height, timestamp=datetime(2026, 1, height, tzinfo=timezone.utc)) for height in heights]


def _read_namespaces(sync_state, blocks, rows, query=NamespaceQuery()):
	with symbol_test_database(sync_state, blocks) as (db_config, puller_database):
		for row in rows:
			puller_database.upsert_namespace(row, [])
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			return database.get_namespaces(query)


class SymbolNamespacesDatabaseTest(TestCase):
	@staticmethod
	def test_rejects_invalid_sort_type_at_database_boundary():
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)

		# Act + Assert:
		with pytest.raises(ValueError, match='^Sort must be either ASC or DESC$'):
			_read_namespaces(sync_state, _blocks(10), [create_symbol_namespace(ROOT_ID)], NamespaceQuery(sort='DESC'))

	def test_returns_exact_items_and_counts_all_descendants(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID, name='foo', full_name='foo', depth=1, start_height=1),
			_namespace(
				CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='bar', full_name='foo.bar', depth=2,
				registration_type='child', start_height=2, end_height=3, alias_type='mosaic',
				alias_mosaic_id='72c0212e67a08bce'
			),
			_namespace(
				LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, name=None, full_name='foo.bar.leaf', depth=3,
				registration_type='child', start_height=3, end_height=4, alias_type='address', alias_address=OTHER_OWNER
			),
			_namespace(OTHER_ROOT_ID, name=None, full_name=None, depth=1, start_height=2, owner_address=OTHER_OWNER)
		]

		# Act:
		views = _read_namespaces(sync_state, _blocks(1, 2, 3, 10), rows)

		# Assert:
		self.assertEqual([LEAF_ID, OTHER_ROOT_ID, CHILD_ID, ROOT_ID], [view.namespace_id for view in views])
		self.assertEqual({
			'id': LEAF_ID,
			'name': LEAF_ID,
			'namespaceName': 'foo.bar.leaf',
			'namespaceLevels': [
				{'name': 'foo', 'namespaceId': ROOT_ID, 'parentId': None},
				{'name': 'bar', 'namespaceId': CHILD_ID, 'parentId': ROOT_ID},
				{'name': LEAF_ID, 'namespaceId': LEAF_ID, 'parentId': CHILD_ID}],
			'aliasType': 'address',
			'aliasMosaicId': None,
			'aliasAddress': str(Address(OTHER_OWNER)),
			'creator': str(Address(OWNER)),
			'registrationHeight': 3,
			'startTimestamp': '2026-01-03 00:00:00',
			'registrationType': 'child',
			'expirationHeight': 4,
			'isUnlimitedDuration': False,
			'subNamespaceCount': 0
		}, views[0].to_dict())
		views_by_id = {view.namespace_id: view for view in views}
		self.assertEqual(2, views_by_id[ROOT_ID].sub_namespace_count)
		self.assertEqual(1, views_by_id[CHILD_ID].sub_namespace_count)
		self.assertEqual(0, views_by_id[LEAF_ID].sub_namespace_count)

	def test_filters_combine_with_and(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		alias_registration_decoy_id = OTHER_ROOT_ID
		owner_registration_decoy_id = 'B95F1F8A96159516'
		owner_alias_child_id = 'C95F1F8A96159516'
		rows = [
			_namespace(ROOT_ID, owner_address=OTHER_OWNER, alias_type='address', alias_address=OTHER_OWNER, start_height=1),
			_namespace(
				alias_registration_decoy_id, owner_address=OWNER, alias_type='address',
				alias_address=OTHER_OWNER, start_height=2),
			_namespace(owner_registration_decoy_id, owner_address=OTHER_OWNER, alias_type='none', start_height=3),
			_namespace(
				owner_alias_child_id, parent_id=ROOT_ID, root_id=ROOT_ID, name='bar', full_name='foo.bar',
				depth=2, registration_type='child', owner_address=OTHER_OWNER, alias_type='address',
				alias_address=OTHER_OWNER, start_height=4),
		]

		# Act:
		and_query = NamespaceQuery(alias_type='address', registration_type='root', owner_address=OTHER_OWNER)
		and_views = _read_namespaces(sync_state, _blocks(1, 2, 3, 4, 10), rows, and_query)
		owner_views = _read_namespaces(
			sync_state, _blocks(1, 2, 3, 4, 10), rows, NamespaceQuery(owner_address=OTHER_OWNER))
		without_alias_views = _read_namespaces(
			sync_state, _blocks(1, 2, 3, 4, 10), rows,
			NamespaceQuery(registration_type='root', owner_address=OTHER_OWNER))
		without_registration_views = _read_namespaces(
			sync_state, _blocks(1, 2, 3, 4, 10), rows,
			NamespaceQuery(alias_type='address', owner_address=OTHER_OWNER))
		without_owner_views = _read_namespaces(
			sync_state, _blocks(1, 2, 3, 4, 10), rows,
			NamespaceQuery(alias_type='address', registration_type='root'))

		# Assert:
		self.assertEqual([ROOT_ID], [view.namespace_id for view in and_views])
		self.assertEqual(
			[owner_alias_child_id, owner_registration_decoy_id, ROOT_ID],
			[view.namespace_id for view in owner_views])
		self.assertEqual(
			[owner_registration_decoy_id, ROOT_ID],
			[view.namespace_id for view in without_alias_views])
		self.assertEqual(
			[owner_alias_child_id, ROOT_ID],
			[view.namespace_id for view in without_registration_views])
		self.assertEqual(
			[alias_registration_decoy_id, ROOT_ID],
			[view.namespace_id for view in without_owner_views])

	def test_returns_empty_page_when_no_namespace_matches(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [_namespace(ROOT_ID, alias_type='none')]

		# Act:
		views = _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

		# Assert:
		self.assertEqual([], views)

	def test_rejects_selected_leaf_with_cyclic_ancestor_chain(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_ancestor_cycle_namespaces(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)

		# Act + Assert: the alias filter pages only the leaf, above the A/B cycle.
		with self.assertRaisesRegex(
			SymbolDataInvalid,
			'^symbol_namespaces.parent_id: namespace hierarchy contains a cycle$'):
			call_with_timeout(
				lambda: _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic')),
				'Namespace database read did not finish within the timeout')

	def test_root_listing_rejects_missing_ancestor_in_selected_family(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID),
			_namespace(
				LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, depth=3, registration_type='child')
		]

		# Act + Assert:
		with self.assertRaisesRegex(
			SymbolDataInvalid,
			'^symbol_namespaces.parent_id: required ancestor is missing$'):
			_read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(registration_type='root'))

	def test_root_filter_returns_root_when_unrelated_orphan_exists(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID),
			_namespace(
				OTHER_ROOT_ID, parent_id=LEAF_ID, root_id=OTHER_ROOT_ID, depth=3, registration_type='child')
		]

		# Act:
		views = _read_namespaces(
			sync_state, _blocks(1, 10), rows, NamespaceQuery(registration_type='root'))

		# Assert:
		self.assertEqual([ROOT_ID], [view.namespace_id for view in views])

	@staticmethod
	def test_rejects_unsafe_filtered_candidate_hidden_after_offset():
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID, start_height=2, alias_type='none'),
			_namespace(OTHER_ROOT_ID, start_height=9, alias_type='none', updated_at_height=11),
		]

		# Act + Assert:
		with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
			_read_namespaces(
				sync_state, _blocks(2, 9, 10), rows,
				NamespaceQuery(limit=1, offset=1, alias_type='none', registration_type='root'))

	@staticmethod
	def test_root_request_rejects_sibling_above_synced_height():
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
		rows[2]['updated_at_height'] = 11

		# Act + Assert:
		with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
			_read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(registration_type='root'))

	def test_selected_child_returns_full_dto_when_sibling_is_above_height(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, LEAF_ID, '72C0212E67A08BCE')
		rows[2]['updated_at_height'] = 11

		# Act:
		views = _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

		# Assert:
		self.assertEqual(
			[expected_symbol_namespace_child_dto(ROOT_ID, CHILD_ID, str(Address(OWNER)), '72C0212E67A08BCE')],
			[view.to_dict() for view in views])

	def test_selected_child_returns_full_dto_when_only_sibling_descendant_is_above_height(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_sibling_rows(
			ROOT_ID, CHILD_ID, LEAF_ID, '72C0212E67A08BCE', descendant_id=OTHER_ROOT_ID)
		rows[3]['updated_at_height'] = 11

		# Act:
		views = _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

		# Assert:
		self.assertEqual(
			[expected_symbol_namespace_child_dto(ROOT_ID, CHILD_ID, str(Address(OWNER)), '72C0212E67A08BCE')],
			[view.to_dict() for view in views])

	@staticmethod
	def test_rejects_selected_child_above_synced_height():
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, NATIVE_MOSAIC_INFO.id)
		rows[1]['updated_at_height'] = 11

		# Act + Assert:
		with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
			_read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

	def test_selected_child_is_readable_with_high_unrelated_root_and_malformed_sibling(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
		rows[2]['depth'] = 3
		rows[2]['updated_at_height'] = 11
		rows.append(_namespace(OTHER_ROOT_ID, updated_at_height=11))

		# Act:
		views = _read_namespaces(
			sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

		# Assert:
		self.assertEqual([CHILD_ID], [view.namespace_id for view in views])
		self.assertEqual(0, views[0].sub_namespace_count)

	@staticmethod
	def test_rejects_selected_child_when_descendant_is_above_synced_height():
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = create_namespace_descendant_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
		rows[2]['updated_at_height'] = 11

		# Act + Assert:
		with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
			_read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

	def test_rejects_invalid_relationship_in_unreachable_page_root_family_rows(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID),
			_namespace(
				CHILD_ID, parent_id=LEAF_ID, root_id=ROOT_ID, depth=2, registration_type='child'),
			_namespace(
				LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, depth=3, registration_type='child')
		]

		# Act + Assert: the B/C cycle is outside the selected root row's descendants.
		with self.assertRaisesRegex(
			SymbolDataInvalid,
			'^symbol_namespaces: descendant relationship is inconsistent$'):
			_read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(registration_type='root'))

	def test_registration_and_alias_filters_keep_expired_rows(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID, alias_type='none'),
			_namespace(
				CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='bar', full_name='foo.bar', depth=2,
				registration_type='child', alias_type='mosaic', alias_mosaic_id=NATIVE_MOSAIC_INFO.id, end_height=2
			),
			_namespace(
				LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, name='leaf', full_name='foo.bar.leaf', depth=3,
				registration_type='child', alias_type='address', alias_address=OTHER_OWNER, end_height=2
			)
		]

		# Act:
		roots = _read_namespaces(
			sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='none', registration_type='root'))
		children = _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(registration_type='child'))
		mosaics = _read_namespaces(sync_state, _blocks(1, 10), rows, NamespaceQuery(alias_type='mosaic'))

		# Assert:
		self.assertEqual([ROOT_ID], [view.namespace_id for view in roots])
		self.assertEqual(2, roots[0].sub_namespace_count)
		self.assertEqual([LEAF_ID, CHILD_ID], [view.namespace_id for view in children])
		self.assertEqual([CHILD_ID], [view.namespace_id for view in mosaics])

	def test_applies_limit_and_offset_after_ordering(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID, start_height=1),
			_namespace(CHILD_ID, start_height=2),
			_namespace(LEAF_ID, start_height=3)
		]

		# Act:
		views = _read_namespaces(sync_state, _blocks(1, 2, 3, 10), rows, NamespaceQuery(limit=1, offset=1))

		# Assert:
		self.assertEqual([CHILD_ID], [view.namespace_id for view in views])

	def test_orders_ties_by_id_in_both_directions(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
		rows = [
			_namespace(ROOT_ID, start_height=2),
			_namespace(CHILD_ID, start_height=1),
			_namespace(LEAF_ID, start_height=2),
		]

		# Act:
		ascending = _read_namespaces(sync_state, _blocks(1, 2, 10), rows, NamespaceQuery(sort=SortOrder.ASC))
		descending = _read_namespaces(sync_state, _blocks(1, 2, 10), rows, NamespaceQuery(sort=SortOrder.DESC))

		# Assert:
		self.assertEqual([CHILD_ID, ROOT_ID, LEAF_ID], [view.namespace_id for view in ascending])
		self.assertEqual([ROOT_ID, LEAF_ID, CHILD_ID], [view.namespace_id for view in descending])


@pytest.mark.parametrize('overrides', [
	{'status': 'unhealthy'},
	{'status': 'repairing'},
	{'dirty_state_from_height': 11},
	{'dirty_state_from_height': 1},
	{'chain_height': 11},
	{'last_synced_height': None},
	{'last_synced_block_hash': None},
	{'last_synced_block_hash': bytes([9]) * 32},
])
def test_invalid_sync_state_denies_list(overrides):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	sync_state.update(overrides)

	# Act + Assert:
	with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
		_read_namespaces(sync_state, _blocks(10), [_namespace(ROOT_ID)])


def test_missing_sync_state_fails():
	# Act + Assert:
	with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
		_read_namespaces(None, _blocks(10), [_namespace(ROOT_ID)])


@pytest.mark.parametrize('kind', ['candidate', 'ancestor', 'descendant'])
def test_rejects_high_namespace_rows(kind):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [_namespace(ROOT_ID)]
	query = NamespaceQuery()
	if kind == 'candidate':
		rows[0]['updated_at_height'] = 11
	elif kind == 'ancestor':
		rows = [
			_namespace(ROOT_ID, updated_at_height=11),
			_namespace(
				CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child'
			)
		]
	else:
		rows = [
			_namespace(ROOT_ID),
			_namespace(CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child', start_height=11)
		]
		query = NamespaceQuery(registration_type='root')
	if kind == 'ancestor':
		query = NamespaceQuery(registration_type='child')

	# Act + Assert:
	with pytest.raises(SymbolDataUnavailable, match='^Symbol namespace data is unavailable$'):
		_read_namespaces(sync_state, _blocks(10), rows, query)


@pytest.mark.parametrize('mutation,error_message', [
	(
		"UPDATE symbol_namespaces SET parent_id = 'D95F1F8A96159516' WHERE namespace_id = 'E74B99BA41F4AFEE'",
		'symbol_namespaces.parent_id: required ancestor is missing'),
	(
		"UPDATE symbol_namespaces SET parent_id = 'E74B99BA41F4AFEE' WHERE namespace_id = 'A95F1F8A96159516'",
		'symbol_namespaces.parent_id: namespace hierarchy contains a cycle'),
	(
		"UPDATE symbol_namespaces SET depth = 3 WHERE namespace_id = 'E74B99BA41F4AFEE'",
		'symbol_namespaces.depth: namespace depth is inconsistent')
])
def test_rejects_corrupt_parent_chain(mutation, error_message):
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=10, finalized_height=10), _blocks(1, 10)) as (db_config, puller_database):
		puller_database.upsert_namespace(_namespace(ROOT_ID), [])
		puller_database.upsert_namespace(_namespace(CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child'), [])
		with puller_database.connection.cursor() as cursor:
			cursor.execute(mutation)
		puller_database.connection.commit()

		# Act + Assert:
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			with pytest.raises(SymbolDataInvalid, match=re.escape(error_message)):
				database.get_namespaces(NamespaceQuery())


@pytest.mark.parametrize('mutation,error_message', [
	(
		"UPDATE symbol_namespaces SET root_id = 'D95F1F8A96159516' WHERE namespace_id = 'E74B99BA41F4AFEE'",
		'symbol_namespaces: descendant relationship is inconsistent'),
	(
		"UPDATE symbol_namespaces SET depth = 3 WHERE namespace_id = 'E74B99BA41F4AFEE'",
		'symbol_namespaces: descendant relationship is inconsistent'),
	(
		"UPDATE symbol_namespaces SET registration_type = 'root' WHERE namespace_id = 'E74B99BA41F4AFEE'",
		'symbol_namespaces.registration_type: child namespace is inconsistent')
])
def test_root_listing_rejects_bad_link(mutation, error_message):
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=10, finalized_height=10), _blocks(1, 10)) as (db_config, puller_database):
		puller_database.upsert_namespace(_namespace(ROOT_ID), [])
		puller_database.upsert_namespace(
			_namespace(CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child'), [])
		with puller_database.connection.cursor() as cursor:
			cursor.execute(mutation)
		puller_database.connection.commit()

		# Act + Assert:
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			with pytest.raises(SymbolDataInvalid, match=re.escape(error_message)):
				database.get_namespaces(NamespaceQuery(registration_type='root'))


def test_missing_block_timestamp_null():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	blocks = _blocks(10)
	rows = [_namespace(ROOT_ID, start_height=5)]

	# Act:
	views = _read_namespaces(sync_state, blocks, rows)
	result = views[0].to_dict()

	# Assert:
	assert result['startTimestamp'] is None


def test_rejects_root_depth_mismatch():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match=re.escape('symbol_namespaces.depth: namespace depth is inconsistent')):
		_read_namespaces(sync_state, _blocks(1, 10), [_namespace(ROOT_ID, depth=2)])


def test_rejects_root_child_type():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match=re.escape('symbol_namespaces: root namespace is inconsistent')):
		_read_namespaces(sync_state, _blocks(1, 10), [_namespace(ROOT_ID, registration_type='child')])


def test_rejects_ancestor_root_type():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='root', start_height=2)
	]

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match=re.escape('symbol_namespaces.registration_type: child namespace is inconsistent')):
		_read_namespaces(sync_state, _blocks(1, 2, 10), rows, NamespaceQuery(limit=1))


def test_rejects_ancestor_root_mismatch():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=OTHER_ROOT_ID, depth=2,
			registration_type='child', start_height=2)
	]

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match=re.escape('symbol_namespaces.root_id: namespace root is inconsistent')):
		_read_namespaces(sync_state, _blocks(1, 2, 10), rows, NamespaceQuery(limit=1))


def test_deleted_descendant_not_counted():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database(sync_state, _blocks(1, 10)) as (db_config, puller_database):
		puller_database.upsert_namespace(_namespace(ROOT_ID), [])
		puller_database.upsert_namespace(
			_namespace(CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child'), [])
		puller_database.delete_namespace(CHILD_ID)

		# Act:
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			result = database.get_namespaces(NamespaceQuery(registration_type='root'))

	# Assert:
	assert [ROOT_ID] == [view.namespace_id for view in result]
	assert 0 == result[0].sub_namespace_count


def test_snapshot_keeps_count_and_time():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	initial_block = create_symbol_block(1, timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc))
	with symbol_test_database(sync_state, _blocks(10) + [initial_block]) as (db_config, puller_database):
		puller_database.upsert_namespace(_namespace(ROOT_ID, start_height=1), [])
		puller_database.upsert_namespace(
			_namespace(CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=2, registration_type='child', start_height=2), [])

		def update_namespace_snapshot():
			puller_database.upsert_blocks([
				create_symbol_block(1, timestamp=datetime(2026, 1, 2, tzinfo=timezone.utc))])
			puller_database.delete_namespace(ROOT_ID)

		database = PausingAfterSyncStateReadSymbolDatabase(db_config)
		try:
			# Act:
			result = read_during_database_snapshot(
				database,
				lambda: database.get_namespaces(NamespaceQuery(registration_type='root')),
				update_namespace_snapshot)

			# Assert: the first request reads the pre-update page, count, and timestamp together.
			assert [ROOT_ID] == [view.namespace_id for view in result]
			assert 1 == result[0].sub_namespace_count
			assert '2026-01-01 00:00:00' == result[0].to_dict()['startTimestamp']
			assert not database.get_namespaces(NamespaceQuery(registration_type='root'))
		finally:
			database.close()


@pytest.mark.parametrize('overrides,field_path,reason', [
	({'namespace_id': 'GGGGGGGGGGGGGGGG'}, 'symbol_namespaces.namespace_id', 'invalid namespace ID'),
	({'parent_id': 'GGGGGGGGGGGGGGGG'}, 'symbol_namespaces.parent_id', 'invalid namespace ID'),
	({'alias_type': 'mosaic', 'alias_mosaic_id': 'invalid'}, 'symbol_namespaces.alias_mosaic_id', 'invalid mosaic ID'),
	({'owner_address': b'\x01'}, 'symbol_namespaces.address', 'invalid persisted address')
])
def test_rejects_bad_namespace_fields(overrides, field_path, reason):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database(sync_state, _blocks(1, 10)) as (db_config, puller_database):
		row = _namespace(ROOT_ID)
		row.update(overrides)
		puller_database.upsert_namespace(row, [])

		# Act + Assert:
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			with pytest.raises(SymbolDataInvalid) as error:
				database.get_namespaces(NamespaceQuery())

	# Assert:
	assert field_path == error.value.field_path
	assert reason == error.value.reason
