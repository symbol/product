from psycopg2.extras import Json

from puller.model.symbol.format import bytes_from_hex_or_none

ACCOUNT_TYPE_LABELS = {
	0: 'unlinked',
	1: 'main',
	2: 'remote',
	3: 'remoteUnlinked'
}
ACCOUNT_TYPE_VALUES = tuple(ACCOUNT_TYPE_LABELS.values())

HARVESTING_ELIGIBLE_MIN_NATIVE_BALANCE = 10_000
HARVESTING_ELIGIBLE_MAX_NATIVE_BALANCE = 50_000_000
HARVESTING_ACTIVE_WINDOW_DAYS = 7


def _public_key_from_hex(public_key_hex):
	public_key = bytes.fromhex(public_key_hex)
	return None if all(0 == byte for byte in public_key) else public_key


def _is_eligible_for_harvesting(account, native_mosaic_id, native_mosaic_divisibility):
	native_balance_raw = next(
		(int(mosaic['amount']) for mosaic in account.get('mosaics', []) if mosaic['id'] == native_mosaic_id),
		0)
	scale = 10 ** native_mosaic_divisibility
	minimum_raw_balance = HARVESTING_ELIGIBLE_MIN_NATIVE_BALANCE * scale
	maximum_raw_balance = HARVESTING_ELIGIBLE_MAX_NATIVE_BALANCE * scale

	return minimum_raw_balance <= native_balance_raw < maximum_raw_balance


def create_account_row(item, network, observed_height, native_mosaic_id, native_mosaic_divisibility):
	"""Creates a persisted Symbol account current-state row and mosaic rows from one node account DTO."""

	account = item['account']
	address = bytes.fromhex(account['address'])
	supplemental_public_keys = account.get('supplementalPublicKeys', {})

	account_row = {
		'address': address,
		'address_text': str(network.address_class(address)),
		'public_key': _public_key_from_hex(account['publicKey']),
		'account_type': ACCOUNT_TYPE_LABELS[int(account['accountType'])],
		'address_height': int(account['addressHeight']),
		'importance': int(account['importance']),
		'importance_percentage': 0,
		'is_harvesting_active': None,
		'is_eligible_for_harvesting': _is_eligible_for_harvesting(account, native_mosaic_id, native_mosaic_divisibility),
		'linked_public_key': bytes_from_hex_or_none(supplemental_public_keys.get('linked', {}).get('publicKey')),
		'node_public_key': bytes_from_hex_or_none(supplemental_public_keys.get('node', {}).get('publicKey')),
		'vrf_public_key': bytes_from_hex_or_none(supplemental_public_keys.get('vrf', {}).get('publicKey')),
		'voting_public_keys': Json(supplemental_public_keys.get('voting', {}).get('publicKeys', [])),
		'activity_buckets': Json(account.get('activityBuckets', [])),
		'raw_payload': Json(item),
		'first_seen_height': observed_height,
		'last_seen_height': observed_height
	}

	mosaic_rows = [
		{
			'address': address,
			'mosaic_id': mosaic['id'],
			'amount': int(mosaic['amount']),
			'updated_at_height': observed_height
		}
		for mosaic in account.get('mosaics', [])
	]

	return account_row, mosaic_rows


def create_multisig_row(address, multisig_json_or_none, observed_height):
	"""Creates a persisted Symbol multisig row from one node multisig DTO, or None for absent multisig state."""

	if multisig_json_or_none is None:
		return None

	return {
		'address': address,
		'min_approval': int(multisig_json_or_none['minApproval']),
		'min_removal': int(multisig_json_or_none['minRemoval']),
		'cosignatory_addresses': [bytes.fromhex(address_hex) for address_hex in multisig_json_or_none['cosignatoryAddresses']],
		'multisig_addresses': [bytes.fromhex(address_hex) for address_hex in multisig_json_or_none['multisigAddresses']],
		'updated_at_height': observed_height
	}
