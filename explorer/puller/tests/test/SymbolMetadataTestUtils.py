import copy

from symbolchain.symbol.Network import Address

from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS

COMPOSITE_HASH = '11' * 32
SOURCE_ADDRESS = SIGNER_ADDRESS
TARGET_ADDRESS = RECIPIENT_ADDRESS
SCOPED_METADATA_KEY = 'B41438ACBBA3E696'
MOSAIC_ID = '72C0212E67A08BCE'
NAMESPACE_ID = 'A95F1F8A96159516'


def metadata_path(
	metadata_type,
	target_id=None,
	source_address=SIGNER_ADDRESS,
	target_address=RECIPIENT_ADDRESS,
	scoped_metadata_key=SCOPED_METADATA_KEY
):
	path = (
		f'metadata?sourceAddress={Address(bytes.fromhex(source_address))}'
		f'&targetAddress={Address(bytes.fromhex(target_address))}'
		f'&scopedMetadataKey={scoped_metadata_key}&metadataType={metadata_type}'
	)
	return path if target_id is None else f'{path}&targetId={target_id}'


def create_metadata_item(
	metadata_type=0,
	target_id='0000000000000000',
	item_id='metadata-item-id',
	composite_hash=COMPOSITE_HASH,
	source_address=SOURCE_ADDRESS,
	target_address=TARGET_ADDRESS,
	scoped_metadata_key=SCOPED_METADATA_KEY,
	value='68656C6C6F'
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	entry = {
		'version': 1,
		'compositeHash': composite_hash,
		'sourceAddress': source_address,
		'targetAddress': target_address,
		'scopedMetadataKey': scoped_metadata_key,
		'targetId': target_id,
		'metadataType': metadata_type,
		'valueSize': len(bytes.fromhex(value)),
		'value': value
	}
	return {'metadataEntry': entry, 'id': item_id}


def create_expected_metadata_row(
	metadata_item,
	observed_height,
	composite_hash,
	metadata_type,
	target_id,
	value_utf8,
	scoped_metadata_key=SCOPED_METADATA_KEY,
	source_address=bytes.fromhex(SOURCE_ADDRESS),
	target_address=bytes.fromhex(TARGET_ADDRESS),
	value_hex='68656C6C6F'
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	return {
		'composite_hash': composite_hash,
		'metadata_type': metadata_type,
		'scoped_metadata_key': scoped_metadata_key,
		'source_address': source_address,
		'target_address': target_address,
		'target_id': target_id,
		'value_hex': value_hex,
		'value_utf8': value_utf8,
		'raw_payload': copy.deepcopy(metadata_item),
		'updated_at_height': observed_height
	}


def fetch_metadata_rows(database):
	cursor = database.connection.cursor()
	cursor.execute(
		'''
		SELECT composite_hash, metadata_type, scoped_metadata_key, source_address, target_address, target_id,
			value_hex, value_utf8, raw_payload, updated_at_height
		FROM symbol_metadata
		ORDER BY composite_hash
		''')
	return [
		{
			'composite_hash': bytes(row[0]),
			'metadata_type': row[1],
			'scoped_metadata_key': row[2],
			'source_address': bytes(row[3]),
			'target_address': bytes(row[4]) if row[4] is not None else None,
			'target_id': row[5],
			'value_hex': row[6],
			'value_utf8': row[7],
			'raw_payload': row[8],
			'updated_at_height': row[9]
		}
		for row in cursor.fetchall()
	]


def fetch_metadata_row(database, composite_hash):
	return next(
		(row for row in fetch_metadata_rows(database) if row['composite_hash'] == composite_hash),
		None)
