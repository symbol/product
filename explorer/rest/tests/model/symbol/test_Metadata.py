import pytest
from symbolchain.symbol.Network import Address

from rest.model.symbol.Metadata import SymbolMetadataView
from rest.model.symbol.validation import SymbolDataInvalid

SENDER = bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57')
TARGET = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')


@pytest.mark.parametrize('kind,target_id,value,value_hex', [
	('account', None, '', ''),
	('mosaic', '00000000000000af', '日本語', '00e697a5'),
	('namespace', '00000000000000af', '\ufffd\ufffd', 'ff00')
])
def test_metadata_view_all_fields(kind, target_id, value, value_hex):
	# Arrange:
	row = ('000000000000000a', target_id, kind, SENDER, TARGET, value, value_hex)

	# Act:
	result = SymbolMetadataView(row).to_dict()

	# Assert:
	assert {
		'scopedMetadataKey': '000000000000000A',
		'targetId': '00000000000000AF' if target_id else None,
		'metadataType': kind,
		'senderAddress': str(Address(SENDER)),
		'targetAddress': str(Address(TARGET)),
		'value': value,
		'valueHex': value_hex.upper()
	} == result


@pytest.mark.parametrize('index,invalid,expected', [
	(3, None, 'symbol_metadata.address: invalid metadata address'),
	(4, b'bad', 'symbol_metadata.address: invalid metadata address'),
	(6, 'F', 'symbol_metadata.value: invalid metadata value'),
	(6, '12 34', 'symbol_metadata.value: invalid metadata value'),
	(6, 'GG', 'symbol_metadata.value: invalid metadata value'),
	(6, '１２', 'symbol_metadata.value: invalid metadata value')
])
def test_invalid_metadata_values(index, invalid, expected):
	# Arrange:
	row = ['0000000000000001', '0000000000000001', 'mosaic', SENDER, TARGET, 'x', '78']
	row[index] = invalid

	# Act:
	with pytest.raises(SymbolDataInvalid) as error:
		SymbolMetadataView(row).to_dict()

	# Assert:
	assert expected == str(error.value)
