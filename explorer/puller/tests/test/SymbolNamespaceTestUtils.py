from puller.model.symbol.Namespace import create_alias_name_rows, create_namespace_row
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS

NAMESPACE_ROOT_ID = 'A95F1F8A96159516'
NAMESPACE_SUB_ID = 'E74B99BA41F4AFEE'
NAMESPACE_SUB_SUB_ID = 'C74B99BA41F4AFEE'


def create_namespace_item(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	namespace_id=NAMESPACE_ROOT_ID,
	root_id=NAMESPACE_ROOT_ID,
	parent_id='0000000000000000',
	alias=None,
	owner_address=BENEFICIARY_ADDRESS,
	start_height='1',
	end_height='18446744073709551615',
	level_ids=None,
	**namespace_overrides
):
	"""Creates a Symbol node namespace DTO for tests.

	By default builds a depth-1 or depth-2 item from namespace_id/root_id. Pass
	level_ids (root-to-leaf order) to build any depth explicitly; when set, it
	takes precedence over namespace_id/root_id, and the caller is responsible
	for passing a matching parent_id.
	"""

	alias = alias or {'type': 0}
	if level_ids is None:
		level_ids = [root_id] if namespace_id == root_id else [root_id, namespace_id]
	depth = len(level_ids)
	namespace = {
		'version': 1,
		'registrationType': 0 if 1 == depth else 1,
		'depth': depth,
		'alias': alias,
		'parentId': parent_id,
		'ownerAddress': owner_address,
		'startHeight': start_height,
		'endHeight': end_height
	}
	for index, level_id in enumerate(level_ids):
		namespace[f'level{index}'] = level_id
	namespace.update(namespace_overrides)

	return {'meta': {'index': 0, 'active': True}, 'namespace': namespace, 'id': f'node-{level_ids[-1]}'}


def create_expected_root_namespace_row(namespace_id, name, owner_address, namespace_item, observed_height, **overrides):
	"""Creates the expected normalized row for a root namespace without an alias."""

	row = {
		'namespace_id': namespace_id,
		'parent_id': None,
		'root_id': namespace_id,
		'name': name,
		'full_name': name,
		'depth': 1,
		'registration_type': 'root',
		'owner_address': bytes.fromhex(owner_address),
		'start_height': 1,
		'end_height': None,
		'alias_type': 'none',
		'alias_mosaic_id': None,
		'alias_address': None,
		'raw_payload': namespace_item,
		'updated_at_height': observed_height
	}
	row.update(overrides)

	return row


def seed_namespace(database, namespace_item, names_by_id, observed_height=0):
	"""Seeds one namespace and its derived alias rows for test Arrange phases."""

	namespace_row = create_namespace_row(namespace_item, names_by_id, observed_height)
	database.upsert_namespace(namespace_row, create_alias_name_rows(namespace_row))


def fetch_namespace_state(connection):
	"""Fetches all namespace columns and deterministic alias rows from a Symbol database."""

	cursor = connection.cursor()
	cursor.execute(
		'''
		SELECT namespace_id, parent_id, root_id, name, full_name, depth, registration_type,
			encode(owner_address, 'hex'), start_height, end_height, alias_type, alias_mosaic_id,
			encode(alias_address, 'hex'), raw_payload, updated_at_height
		FROM symbol_namespaces
		ORDER BY namespace_id
		''')
	namespace_rows = cursor.fetchall()
	cursor.execute(
		'''
		SELECT artifact_type, artifact_id, name, updated_at_height
		FROM symbol_alias_names
		ORDER BY artifact_type, artifact_id, name
		''')

	return namespace_rows, cursor.fetchall()
