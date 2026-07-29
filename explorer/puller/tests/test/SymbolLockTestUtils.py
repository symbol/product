import copy


def create_secret_lock_item(
	composite_hash='BB' * 32,
	owner_address='98' + '11' * 23,
	recipient_address='98' + '22' * 23,
	secret='CC' * 32,
	hash_algorithm=1,
	mosaic_id='72C0212E67A08BCE',
	amount='1234',
	end_height='5678',
	status=1,
	item_id='secret-item',
	lock_overrides=None,
	**overrides
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	lock = {
		'compositeHash': composite_hash,
		'ownerAddress': owner_address,
		'recipientAddress': recipient_address,
		'secret': secret,
		'hashAlgorithm': hash_algorithm,
		'mosaicId': mosaic_id,
		'amount': amount,
		'endHeight': end_height,
		'status': status
	}
	if lock_overrides:
		lock.update(lock_overrides)
	lock.update(overrides)
	return {'lock': lock, 'id': item_id}


def create_expected_secret_lock_row(
	secret_lock_item,
	observed_height,
	composite_hash=bytes.fromhex('BB' * 32),
	owner_address=bytes.fromhex('98' + '11' * 23),
	recipient_address=bytes.fromhex('98' + '22' * 23),
	secret=bytes.fromhex('CC' * 32),
	hash_algorithm='hash160',
	mosaic_id='72C0212E67A08BCE',
	amount=1234,
	end_height=5678,
	status='used'
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	return {
		'raw_payload': copy.deepcopy(secret_lock_item),
		'updated_at_height': observed_height,
		'composite_hash': composite_hash,
		'secret': secret,
		'hash_algorithm': hash_algorithm,
		'owner_address': owner_address,
		'recipient_address': recipient_address,
		'mosaic_id': mosaic_id,
		'status': status,
		'end_height': end_height,
		'amount': amount
	}
