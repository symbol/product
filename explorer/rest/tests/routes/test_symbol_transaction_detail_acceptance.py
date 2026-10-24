from pathlib import Path

from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest import create_app

from ..test.EnvTestUtils import rest_settings_env
from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import symbol_test_database
from ..test.SymbolMosaicTestUtils import create_symbol_mosaic
from ..test.SymbolTransactionTestUtils import RECIPIENT_ADDRESS, SIGNER_ADDRESS, create_symbol_transaction

SENDER = 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI'
RECIPIENT = 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ'
TARGET = 'TABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQ'
ALIAS_ADDRESS = 'TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI'
LINKED = 'TCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ6HIVBI'
COSIGNER = 'TD3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6OR6OIY'
MOSAIC_ID = '1234567890ABCDEF'
NAMESPACE_ID = '0000000000000001'
NAMESPACE_NAME = 'acceptance.namespace'
SIGNATURE = 'CD' * 64
HASHES = {code.value: f'{index:064X}' for index, code in enumerate(TransactionType, 1)}


def _body_cases():
	return {
		TransactionType.TRANSFER.value: {},
		TransactionType.ACCOUNT_KEY_LINK.value: {'linkAction': 1, 'linkedPublicKey': '01' * 32},
		TransactionType.NODE_KEY_LINK.value: {'linkAction': 1, 'linkedPublicKey': '01' * 32},
		TransactionType.AGGREGATE_COMPLETE.value: {
			'transactionsHash': 'AA' * 32,
			'cosignatures': [{'signerPublicKey': '02' * 32, 'signature': 'EF' * 64}]},
		TransactionType.AGGREGATE_BONDED.value: {'transactionsHash': 'AB' * 32, 'cosignatures': []},
		TransactionType.VOTING_KEY_LINK.value: {
			'linkAction': 1, 'linkedPublicKey': '01' * 32, 'startEpoch': 1, 'endEpoch': 2},
		TransactionType.VRF_KEY_LINK.value: {'linkAction': 1, 'linkedPublicKey': '01' * 32},
		TransactionType.HASH_LOCK.value: {'duration': 1, 'hash': 'AA' * 32},
		TransactionType.SECRET_LOCK.value: {
			'duration': 1, 'secret': 'AA' * 32, 'hashAlgorithm': 0},
		TransactionType.SECRET_PROOF.value: {'secret': 'AA' * 32, 'proof': 'BB', 'hashAlgorithm': 0},
		TransactionType.ACCOUNT_METADATA.value: {
			'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1},
		TransactionType.MOSAIC_METADATA.value: {
			'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1, 'targetMosaicId': '01'},
		TransactionType.NAMESPACE_METADATA.value: {
			'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1, 'targetNamespaceId': NAMESPACE_ID},
		TransactionType.MOSAIC_DEFINITION.value: {
			'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': 0},
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: {'mosaicId': '01', 'action': 1, 'delta': 1},
		TransactionType.MOSAIC_SUPPLY_REVOCATION.value: {'mosaicId': '01'},
		TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: {
			'minApprovalDelta': 0, 'minRemovalDelta': 0, 'addressAdditions': [], 'addressDeletions': []},
		TransactionType.ADDRESS_ALIAS.value: {
			'namespaceId': NAMESPACE_ID, 'aliasAction': 1, 'address': '98' + '01' * 23},
		TransactionType.MOSAIC_ALIAS.value: {
			'namespaceId': NAMESPACE_ID, 'aliasAction': 1, 'mosaicId': '01'},
		TransactionType.NAMESPACE_REGISTRATION.value: {
			'id': NAMESPACE_ID, 'name': 'acceptance', 'registrationType': 'root', 'parentId': None, 'duration': 1},
		TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: {
			'restrictionFlags': 1, 'restrictionAdditions': [], 'restrictionDeletions': []},
		TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: {
			'restrictionFlags': 2, 'restrictionAdditions': [], 'restrictionDeletions': []},
		TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: {
			'restrictionFlags': 4, 'restrictionAdditions': [], 'restrictionDeletions': []},
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: {
			'mosaicId': '01', 'restrictionKey': '01', 'previousRestrictionValue': 0, 'newRestrictionValue': 1},
		TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: {
			'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '01',
			'previousRestrictionType': 0, 'previousRestrictionValue': 0,
			'newRestrictionType': 1, 'newRestrictionValue': 1}
	}


def _mosaic_rows(transaction_type):
	role = {
		TransactionType.HASH_LOCK.value: 'hash_lock',
		TransactionType.SECRET_LOCK.value: 'secret_lock',
		TransactionType.MOSAIC_METADATA.value: 'metadata_target',
		TransactionType.MOSAIC_DEFINITION.value: 'definition',
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: 'definition',
		TransactionType.MOSAIC_SUPPLY_REVOCATION.value: 'revocation',
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: 'restriction',
		TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: 'restriction'
	}.get(transaction_type)
	if not role:
		return []
	return [{'mosaic_id': MOSAIC_ID, 'amount': 100, 'role': role, 'position': 0}]


def _address_rows(transaction_type):
	rows = [{'address': SIGNER_ADDRESS, 'role': 'signer'}]
	if transaction_type in {
		TransactionType.TRANSFER.value, TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value}:
		rows.append({'address': bytes.fromhex('98' + '02' * 23), 'role': 'recipient'})
	return rows


def _fixture_transaction(transaction_type, number, body, is_embedded=False, aggregate_hash=None):
	transaction = create_symbol_transaction(
		1,
		number,
		is_embedded=is_embedded,
		hash=None if is_embedded else bytes.fromhex(HASHES[transaction_type]),
		aggregate_hash=aggregate_hash,
		embedded_index=0 if is_embedded else None,
		type=transaction_type,
		body={'network': Network.TESTNET.identifier, 'version': 1, **body},
		raw_payload={'transaction': {'network': Network.TESTNET.identifier, 'version': 1, 'signature': SIGNATURE}},
		recipient_address=RECIPIENT_ADDRESS if transaction_type in {
			TransactionType.TRANSFER.value, TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value} else None,
		mosaic_rows=_mosaic_rows(transaction_type),
		address_rows=_address_rows(transaction_type),
		message_type='plain' if transaction_type == TransactionType.TRANSFER.value else None,
		message_payload='48656C6C6F' if transaction_type == TransactionType.TRANSFER.value else None)
	if transaction_type in {
		TransactionType.ACCOUNT_METADATA.value, TransactionType.MOSAIC_METADATA.value,
		TransactionType.NAMESPACE_METADATA.value, TransactionType.MOSAIC_ADDRESS_RESTRICTION.value}:
		transaction['target_address'] = bytes.fromhex('98' + '02' * 23)
	if transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value:
		transaction['source_address'] = SIGNER_ADDRESS
		transaction['address_rows'].append({'address': SIGNER_ADDRESS, 'role': 'sender'})
	return transaction


def _expected_detail(transaction_type):
	mos = [{'id': MOSAIC_ID, 'name': MOSAIC_ID, 'amount': 1.0}]
	return {
		TransactionType.TRANSFER.value: {'recipient': RECIPIENT, 'mosaics': [], 'message': {'type': 'plain', 'text': 'Hello'}},
		TransactionType.ACCOUNT_KEY_LINK.value: {'linkAction': 'link', 'linkedPublicKey': '01' * 32, 'linkedAccountAddress': LINKED},
		TransactionType.NODE_KEY_LINK.value: {'linkAction': 'link', 'linkedPublicKey': '01' * 32, 'linkedAccountAddress': LINKED},
		TransactionType.AGGREGATE_COMPLETE.value: {'transactionsHash': 'AA' * 32},
		TransactionType.AGGREGATE_BONDED.value: {'transactionsHash': 'AB' * 32},
		TransactionType.VOTING_KEY_LINK.value: {
			'linkAction': 'link', 'linkedPublicKey': '01' * 32, 'linkedAccountAddress': LINKED, 'startEpoch': 1, 'endEpoch': 2},
		TransactionType.VRF_KEY_LINK.value: {
			'linkAction': 'link', 'linkedPublicKey': '01' * 32, 'linkedAccountAddress': LINKED},
		TransactionType.HASH_LOCK.value: {'mosaics': mos, 'duration': '1', 'hash': 'AA' * 32},
		TransactionType.SECRET_LOCK.value: {
			'mosaics': mos, 'recipient': RECIPIENT, 'duration': '1', 'secret': 'AA' * 32, 'hashAlgorithm': 'sha3_256'},
		TransactionType.SECRET_PROOF.value: {
			'recipient': RECIPIENT, 'secret': 'AA' * 32, 'proof': 'BB', 'hashAlgorithm': 'sha3_256'},
		TransactionType.ACCOUNT_METADATA.value: {
			'targetAddress': TARGET, 'scopedMetadataKey': '0000000000000001', 'valueDelta': 'AA', 'valueSizeDelta': 1},
		TransactionType.MOSAIC_METADATA.value: {
			'targetAddress': TARGET, 'scopedMetadataKey': '0000000000000001', 'valueDelta': 'AA', 'valueSizeDelta': 1,
			'targetMosaicId': MOSAIC_ID, 'targetMosaicAliasNames': []},
		TransactionType.NAMESPACE_METADATA.value: {
			'targetAddress': TARGET, 'scopedMetadataKey': '0000000000000001', 'valueDelta': 'AA', 'valueSizeDelta': 1,
			'targetNamespaceId': NAMESPACE_ID, 'namespaceName': NAMESPACE_NAME},
		TransactionType.MOSAIC_DEFINITION.value: {
			'mosaicId': '0000000000000001', 'divisibility': 0, 'duration': '1', 'nonce': 1, 'supplyMutable': False,
			'transferable': False, 'restrictable': False, 'revokable': False},
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: {'mosaicId': MOSAIC_ID, 'action': 'increase', 'delta': '1'},
		TransactionType.MOSAIC_SUPPLY_REVOCATION.value: {'address': SENDER, 'mosaics': mos},
		TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: {
			'minApprovalDelta': 0, 'minRemovalDelta': 0, 'addressAdditions': [], 'addressDeletions': []},
		TransactionType.ADDRESS_ALIAS.value: {
			'namespaceId': NAMESPACE_ID, 'namespaceName': NAMESPACE_NAME, 'aliasAction': 'link', 'address': ALIAS_ADDRESS},
		TransactionType.MOSAIC_ALIAS.value: {
			'namespaceId': NAMESPACE_ID, 'namespaceName': NAMESPACE_NAME, 'aliasAction': 'link',
			'mosaicId': '0000000000000001'},
		TransactionType.NAMESPACE_REGISTRATION.value: {
			'namespaceId': NAMESPACE_ID, 'namespaceName': 'acceptance', 'registrationType': 'root',
			'parentId': None, 'duration': '1'},
		TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value: {
			'restrictionFlags': 1, 'restrictionType': 'Allow Incoming Address',
			'restrictionAddressAdditions': [], 'restrictionAddressDeletions': []},
		TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value: {
			'restrictionFlags': 2, 'restrictionType': 'Allow Incoming Mosaic',
			'restrictionMosaicAdditions': [], 'restrictionMosaicDeletions': []},
		TransactionType.ACCOUNT_OPERATION_RESTRICTION.value: {
			'restrictionFlags': 4, 'restrictionType': 'Allow Incoming Operation',
			'restrictionOperationAdditions': [], 'restrictionOperationDeletions': []},
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: {
			'mosaicId': MOSAIC_ID, 'mosaicAliasNames': [], 'targetAddress': TARGET,
			'restrictionKey': '0000000000000001', 'previousRestrictionValue': '0', 'newRestrictionValue': '1'},
		TransactionType.MOSAIC_GLOBAL_RESTRICTION.value: {
			'mosaicId': MOSAIC_ID, 'referenceMosaicId': '0000000000000000', 'mosaicAliasNames': [],
			'restrictionKey': '0000000000000001', 'previousRestrictionType': 'NONE',
			'previousRestrictionValue': '0', 'newRestrictionType': 'EQ', 'newRestrictionValue': '1'}
	}[transaction_type]


def _expected_info(is_embedded=False, amount=0, value=None, recipient=None):
	return {
		'height': 1,
		'timestamp': '2026-01-01 00:00:00' if is_embedded else '2026-01-01 00:00:01',
		'fee': None if is_embedded else 1e-06,
		'value': value if is_embedded else ([] if value is None else value),
		'amount': amount if is_embedded else amount,
		'maxFee': None if is_embedded else 0.0001,
		'deadline': None if is_embedded else '2026-01-01 00:00:00',
		'sender': SENDER, 'recipient': recipient,
		'signerPublicKey': '01' * 32, 'signature': None if is_embedded else SIGNATURE,
		'size': None if is_embedded else 1,
		'block': {
			'height': 1, 'hash': '01' * 32, 'timestamp': '2026-01-01 00:00:00', 'feeMultiplier': 1}}


def _expected_response(
	transaction_type, transaction_hash, detail, value=None, amount=0, aggregate=None, hash_lock=None
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	graphic_sender = SENDER
	graphic_recipient = detail.get('recipient')
	if transaction_type == TransactionType.MOSAIC_SUPPLY_REVOCATION.value:
		graphic_recipient = SENDER
	if transaction_type == TransactionType.ADDRESS_ALIAS.value:
		graphic_recipient = ALIAS_ADDRESS
	recipient = RECIPIENT if transaction_type in {
		TransactionType.TRANSFER.value, TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value} else None
	return {
		'hash': transaction_hash, 'isEmbedded': False, 'aggregateHash': None, 'embeddedIndex': None,
		'group': 'confirmed', 'type': TransactionType(transaction_type).name, 'version': 1,
		'info': _expected_info(amount=amount, value=value, recipient=recipient), 'detail': detail, 'aggregate': aggregate,
		'hashLock': hash_lock, 'graphic': {'transactions': [{
			'type': TransactionType(transaction_type).name, 'sender': graphic_sender,
			'recipient': graphic_recipient, 'detail': detail}]}}


def _expected_embedded_transfer(parent_hash):
	detail = {'recipient': RECIPIENT, 'mosaics': [], 'message': {'type': 'plain', 'text': 'Hello'}}
	return {
		'hash': None, 'isEmbedded': True, 'aggregateHash': parent_hash, 'embeddedIndex': 0,
		'group': 'confirmed', 'type': 'TRANSFER', 'version': 1,
		'info': _expected_info(is_embedded=True, value=[], amount=0, recipient=RECIPIENT), 'detail': detail,
		'graphic': {'type': 'TRANSFER', 'sender': SENDER, 'recipient': RECIPIENT, 'detail': detail}}


def _expected_hash_lock(transaction_hash):
	return {
		'transactionHash': transaction_hash, 'ownerAddress': SENDER, 'endHeight': 20, 'status': 'unused',
		'mosaics': [{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 1.0, 'isNative': True}]}


def _write_app_config(tmp_path, db_config):
	db_path = Path(tmp_path) / 'symbol_db.ini'
	db_path.write_text(
		f'[symbol_db]\ndatabase = {db_config.database}\nuser = {db_config.user}\npassword =\nhost = {db_config.host}\nport = {db_config.port}\n',
		encoding='utf8')
	app_path = Path(tmp_path) / 'symbol_app.config'
	app_path.write_text(
		f'REST_CHAIN="symbol"\nDATABASE_CONFIG_FILEPATH="{db_path}"\nSYMBOL_NODE_URL="http://localhost:3000"\n'
		'SYMBOL_NODE_ALLOWED_HOSTS="localhost:3000"\nSYMBOL_NODE_ALLOW_LOOPBACK="true"\n'
		'SYMBOL_NODE_ALLOW_PRIVATE="false"\nSYMBOL_NATIVE_MOSAIC_ID="72C0212E67A08BCE"\n'
		'SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS=7200\nSYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS=7\nNETWORK_NAME="testnet"\n',
		encoding='utf8')
	return app_path


def test_confirmed_25_types_over_http(tmp_path):  # pylint: disable=too-many-locals
	"""Compare complete HTTP DTOs with independently authored contract fixtures."""
	# Arrange:
	cases = _body_cases()
	transactions = []
	for number, transaction_type in enumerate(cases, 1):
		transactions.append(_fixture_transaction(transaction_type, number, cases[transaction_type]))
	for aggregate_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
		aggregate_hash = bytes.fromhex(HASHES[aggregate_type])
		transactions.append(_fixture_transaction(
			TransactionType.TRANSFER.value, 100 + aggregate_type,
			cases[TransactionType.TRANSFER.value], True, aggregate_hash))
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=1, finalized_height=1),
		[create_symbol_block(1)], [create_symbol_mosaic(MOSAIC_ID, 2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(1, transactions)
		bonded_hash = bytes.fromhex(HASHES[TransactionType.AGGREGATE_BONDED.value])
		puller_database.upsert_hash_lock({
			'hash': bonded_hash, 'owner_address': SIGNER_ADDRESS, 'mosaic_id': '72C0212E67A08BCE',
			'amount': 1000000, 'end_height': 20, 'status': 'unused', 'raw_payload': {}, 'updated_at_height': 1})
		puller_database.upsert_namespace({
			'namespace_id': NAMESPACE_ID, 'parent_id': None, 'root_id': NAMESPACE_ID, 'name': 'namespace',
			'full_name': NAMESPACE_NAME, 'depth': 1, 'registration_type': 'root', 'owner_address': SIGNER_ADDRESS,
			'start_height': 1, 'end_height': None, 'alias_type': 'none', 'alias_mosaic_id': None,
			'alias_address': None, 'raw_payload': {}, 'updated_at_height': 1}, [])
		app_path = _write_app_config(tmp_path, db_config)
		with rest_settings_env(app_path):
			app = create_app()
			client = app.test_client()
			try:
				# Act:
				for transaction_type in cases:
					hash_value = HASHES[transaction_type]
					response = client.get(f'/api/symbol/transaction/{hash_value}')
					assert response.status_code == 200, (transaction_type, response.json)
					value = [{'id': MOSAIC_ID, 'name': MOSAIC_ID, 'amount': 1.0}] if _mosaic_rows(transaction_type) else []
					if transaction_type == TransactionType.MOSAIC_METADATA.value:
						value = []
					expected = _expected_response(
						transaction_type, hash_value, _expected_detail(transaction_type), value=value,
						hash_lock=_expected_hash_lock(hash_value) if transaction_type == TransactionType.AGGREGATE_BONDED.value else None)
					if transaction_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
						cosignatures = []
						if transaction_type == TransactionType.AGGREGATE_COMPLETE.value:
							cosignatures = [{'signer': COSIGNER, 'signature': 'EF' * 64}]
						expected['aggregate'] = {
							'hash': hash_value, 'embeddedTransactions': [_expected_embedded_transfer(hash_value)],
							'cosignatures': cosignatures}
						expected['graphic'] = {'transactions': [_expected_embedded_transfer(hash_value)['graphic']]}
					# Assert:
					assert response.json == expected
			finally:
				app.extensions['symbol_database'].close()


def test_missing_recipient_transfer_503(tmp_path):
	# Arrange:
	transaction = _fixture_transaction(TransactionType.TRANSFER.value, 101, {})
	transaction['hash'] = bytes.fromhex('FF' * 32)
	transaction['recipient_address'] = None
	transaction['address_rows'] = [{'address': SIGNER_ADDRESS, 'role': 'signer'}]
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=1, finalized_height=1),
		[create_symbol_block(1)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(1, [transaction])
		app_path = _write_app_config(tmp_path, db_config)
		with rest_settings_env(app_path):
			app = create_app()
			client = app.test_client()
			try:
				# Act:
				response = client.get('/api/symbol/transaction/' + 'FF' * 32)
			finally:
				app.extensions['symbol_database'].close()

	# Assert:
	assert response.status_code == 503
	assert response.json == {'status': 503, 'message': 'Symbol backend data is unavailable'}
