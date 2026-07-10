from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS

NAMESPACE_ROOT_ID = 'A95F1F8A96159516'
NAMESPACE_SUB_ID = 'E74B99BA41F4AFEE'


def create_namespace_item(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	namespace_id=NAMESPACE_ROOT_ID,
	root_id=NAMESPACE_ROOT_ID,
	parent_id='0000000000000000',
	alias=None,
	owner_address=BENEFICIARY_ADDRESS,
	start_height='1',
	end_height='18446744073709551615',
	**namespace_overrides
):
	"""Creates a Symbol node namespace DTO for tests."""

	alias = alias or {'type': 0}
	depth = 1 if namespace_id == root_id else 2
	namespace = {
		'version': 1,
		'registrationType': 0 if 1 == depth else 1,
		'depth': depth,
		'level0': root_id,
		'alias': alias,
		'parentId': parent_id,
		'ownerAddress': owner_address,
		'startHeight': start_height,
		'endHeight': end_height
	}
	if 2 == depth:
		namespace['level1'] = namespace_id
	namespace.update(namespace_overrides)

	return {'meta': {'index': 0, 'active': True}, 'namespace': namespace, 'id': f'node-{namespace_id}'}


def create_expected_root_namespace_row(namespace_id, name, owner_address, namespace_item, observed_height):
	"""Creates the expected normalized row for a root namespace without an alias."""

	return {
		'namespace_id': namespace_id,
		'parent_id': None,
		'root_id': namespace_id,
		'name': name,
		'full_name': name,
		'depth': 1,
		'registration_type': 0,
		'owner_address': bytes.fromhex(owner_address),
		'start_height': 1,
		'end_height': None,
		'alias_type': 0,
		'alias_mosaic_id': None,
		'alias_address': None,
		'raw_payload': namespace_item,
		'updated_at_height': observed_height
	}
