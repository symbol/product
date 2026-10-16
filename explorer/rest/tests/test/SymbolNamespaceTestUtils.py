from threading import Event, Thread

DEFAULT_NAMESPACE_OWNER = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')


def create_symbol_namespace(namespace_id, **overrides):
	"""Creates a persisted namespace row for REST tests."""

	row = {
		'namespace_id': namespace_id,
		'parent_id': None,
		'root_id': namespace_id,
		'name': 'foo',
		'full_name': f'foo-{namespace_id.lower()}',
		'depth': 1,
		'registration_type': 'root',
		'owner_address': DEFAULT_NAMESPACE_OWNER,
		'start_height': 1,
		'end_height': None,
		'alias_type': 'none',
		'alias_mosaic_id': None,
		'alias_address': None,
		'raw_payload': {'namespaceId': namespace_id},
		'updated_at_height': 1
	}
	row.update(overrides)
	return row


def create_namespace_root_child_rows(root_id, child_id, alias_mosaic_id):
	"""Creates a root namespace with one aliased child."""
	return [
		create_symbol_namespace(root_id, name='foo', full_name='foo'),
		create_symbol_namespace(
			child_id, parent_id=root_id, root_id=root_id, name='bar', full_name='foo.bar', depth=2,
			registration_type='child', alias_type='mosaic', alias_mosaic_id=alias_mosaic_id),
	]


def create_namespace_sibling_rows(root_id, child_id, sibling_id, alias_mosaic_id, descendant_id=None):
	"""Creates one selected child and a structurally valid sibling subtree."""
	rows = create_namespace_root_child_rows(root_id, child_id, alias_mosaic_id)
	rows.append(
		create_symbol_namespace(
			sibling_id, parent_id=root_id, root_id=root_id, name='sibling', full_name='foo.sibling', depth=2,
			registration_type='child'))
	if descendant_id is not None:
		rows.append(create_symbol_namespace(
			descendant_id, parent_id=sibling_id, root_id=root_id, name='descendant',
			full_name='foo.sibling.descendant', depth=3, registration_type='child'))

	return rows


def create_namespace_descendant_rows(root_id, child_id, descendant_id, alias_mosaic_id):
	"""Creates a selected child with one direct descendant."""
	rows = create_namespace_root_child_rows(root_id, child_id, alias_mosaic_id)
	rows.append(create_symbol_namespace(
		descendant_id, parent_id=child_id, root_id=root_id, name='descendant',
		full_name='foo.bar.descendant', depth=3, registration_type='child'))
	return rows


def expected_symbol_namespace_child_dto(root_id, child_id, creator, alias_mosaic_id, sub_namespace_count=0):
	"""Returns an independently hardcoded expected child namespace DTO."""
	return {
		'id': child_id,
		'name': child_id,
		'namespaceName': 'foo.bar',
		'namespaceLevels': [
			{'name': 'foo', 'namespaceId': root_id, 'parentId': None},
			{'name': 'bar', 'namespaceId': child_id, 'parentId': root_id}],
		'aliasType': 'mosaic',
		'aliasMosaicId': alias_mosaic_id,
		'aliasAddress': None,
		'creator': creator,
		'registrationHeight': 1,
		'startTimestamp': '2026-01-01 00:00:00',
		'registrationType': 'child',
		'expirationHeight': None,
		'isUnlimitedDuration': True,
		'subNamespaceCount': sub_namespace_count
	}


def create_ancestor_cycle_namespaces(root_id, child_id, leaf_id, alias_mosaic_id):
	"""Creates a selected leaf whose ancestor chain contains a separate cycle."""
	return [
		create_symbol_namespace(root_id, parent_id=child_id, depth=1),
		create_symbol_namespace(child_id, parent_id=root_id, root_id=root_id, depth=2, registration_type='child'),
		create_symbol_namespace(
			leaf_id, parent_id=child_id, root_id=root_id, depth=3, registration_type='child',
			alias_type='mosaic', alias_mosaic_id=alias_mosaic_id)
	]


def call_with_timeout(action, error_message, timeout=10):
	"""Runs a potentially non-terminating regression action with a hard wait bound."""
	finished = Event()
	result = []

	def invoke():
		try:
			result.append((True, action()))
		except Exception as error:  # pylint: disable=broad-exception-caught
			result.append((False, error))
		finally:
			finished.set()

	worker = Thread(target=invoke, daemon=True)
	worker.start()
	assert finished.wait(timeout), error_message
	succeeded, value = result[0]
	if not succeeded:
		raise value
	return value
