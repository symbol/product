"""Normalization helpers for Symbol namespace current state."""

NAMESPACE_UNLIMITED_END_HEIGHT = 0xFFFFFFFFFFFFFFFF


def create_namespace_row(namespace_item, names_by_id, observed_height):
	"""Creates one persisted namespace row from a Symbol node namespace response."""

	namespace = namespace_item['namespace']
	depth = int(namespace['depth'])
	level_ids = [namespace[f'level{index}'] for index in range(depth)]
	if any(level_id not in names_by_id for level_id in level_ids):
		raise ValueError('Missing namespace level name')

	namespace_id = level_ids[-1]
	alias = namespace['alias']
	end_height = int(namespace['endHeight'])
	parent_id = namespace.get('parentId')
	return {
		'namespace_id': namespace_id,
		'parent_id': None if '0000000000000000' == parent_id else parent_id,
		'root_id': level_ids[0],
		'name': names_by_id[namespace_id],
		'full_name': '.'.join(names_by_id[level_id] for level_id in level_ids),
		'depth': depth,
		'registration_type': int(namespace['registrationType']),
		'owner_address': bytes.fromhex(namespace['ownerAddress']),
		'start_height': int(namespace['startHeight']),
		'end_height': None if NAMESPACE_UNLIMITED_END_HEIGHT == end_height else end_height,
		'alias_type': int(alias['type']),
		'alias_mosaic_id': alias.get('mosaicId'),
		'alias_address': bytes.fromhex(alias['address']) if alias.get('address') else None,
		'raw_payload': namespace_item,
		'updated_at_height': observed_height
	}


def create_alias_name_rows(namespace_row, network):
	"""Creates persisted alias-name lookup rows for one normalized namespace."""

	common_row = {
		'name': namespace_row['full_name'],
		'updated_at_height': namespace_row['updated_at_height']
	}
	rows = [{
		**common_row,
		'artifact_type': 'namespace',
		'artifact_id': namespace_row['namespace_id']
	}]
	if 1 == namespace_row['alias_type']:
		rows.append({
			**common_row,
			'artifact_type': 'mosaic',
			'artifact_id': namespace_row['alias_mosaic_id']
		})
	elif 2 == namespace_row['alias_type']:
		rows.append({
			**common_row,
			'artifact_type': 'account',
			'artifact_id': str(network.address_class(namespace_row['alias_address']))
		})

	return rows
