from decimal import Decimal

from psycopg2.extras import Json

ACCOUNT_ADDRESS = bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57')
OTHER_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
PUBLIC_KEY = bytes.fromhex('01' * 32)


def create_symbol_account_row(address=ACCOUNT_ADDRESS, address_text='TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', **overrides):
	"""Creates one current-state Account row shared by REST database fixtures."""

	row = {
		'address': address,
		'address_text': address_text,
		'public_key': PUBLIC_KEY,
		'account_type': 'main',
		'address_height': 123,
		'importance': 100,
		'importance_percentage': Decimal('0.025'),
		'is_harvesting_active': None,
		'is_eligible_for_harvesting': True,
		'linked_public_key': bytes.fromhex('11' * 32),
		'node_public_key': bytes.fromhex('22' * 32),
		'vrf_public_key': bytes.fromhex('00' * 32),
		'voting_public_keys': Json([{'publicKey': 'AB' * 32, 'startEpoch': '100', 'endEpoch': '200'}]),
		'activity_buckets': Json([{
			'startHeight': '0', 'totalFeesPaid': '1234567', 'beneficiaryCount': 2, 'rawScore': '5000000000'
		}]),
		'raw_payload': Json({'address': address_text}),
		'first_seen_height': 1,
		'last_seen_height': 100
	}
	row.update(overrides)
	return row
