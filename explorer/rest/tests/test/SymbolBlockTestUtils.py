from datetime import datetime, timezone

from psycopg2.extras import Json


def create_symbol_sync_state(last_synced_height, finalized_height, **overrides):
	sync_state = {
		'status': 'healthy',
		'chain_height': last_synced_height,
		'finalized_height': finalized_height,
		'finalized_hash': bytes([finalized_height]) * 32 if finalized_height else None,
		'finalized_epoch': 2 if finalized_height else None,
		'finalized_point': 3 if finalized_height else None,
		'last_synced_height': last_synced_height,
		'last_synced_block_hash': bytes([last_synced_height]) * 32
	}
	sync_state.update(overrides)
	return sync_state


def create_symbol_block(height, **overrides):
	block = {
		'height': height,
		'hash': bytes([height]) * 32,
		'previous_hash': bytes([height - 1]) * 32,
		'timestamp': datetime(2026, 1, height, tzinfo=timezone.utc),
		'network_timestamp': height * 1000,
		'total_fee': height * 1000000,
		'transactions_count': height,
		'total_transactions_count': height + 10,
		'statements_count': height,
		'difficulty': 1000000 + height,
		'fee_multiplier': height,
		'block_type': 'nemesis',
		'signer_public_key': bytes([height]) * 32,
		'signer_address': bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2'),
		'beneficiary_address': bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'),
		'signature': bytes([height]) * 64,
		'size': 100 + height,
		'proof_gamma': bytes([height]) * 32,
		'proof_verification_hash': bytes([height]) * 16,
		'proof_scalar': bytes([height]) * 32,
		'state_hash': bytes([height]) * 32,
		'transactions_hash': bytes([height]) * 32,
		'receipts_hash': bytes([height]) * 32,
		'state_hash_sub_cache_roots': Json([f'ROOT {height}']),
		'voting_eligible_accounts_count': None,
		'harvesting_eligible_accounts_count': None,
		'total_voting_balance': None,
		'previous_importance_block_hash': None,
		'raw_payload': Json({'height': height})
	}
	block.update(overrides)

	return block


def create_symbol_importance_block(height):
	return create_symbol_block(
		height,
		voting_eligible_accounts_count=4,
		harvesting_eligible_accounts_count=17,
		total_voting_balance=19000235663367,
		previous_importance_block_hash=bytes.fromhex('86' * 32))
