import pytest
from common.symbol.NativeMosaic import (
	MAX_NATIVE_MOSAIC_DIVISIBILITY,
	NativeMosaicInfo,
	create_native_mosaic_info,
	extract_native_mosaic_id,
	normalize_native_mosaic_divisibility,
	normalize_native_mosaic_id
)

NETWORK_PROPERTIES = {'chain': {'currencyMosaicId': "0x72C0'212E'67A0'8BCE"}}
MOSAIC_DEFINITION = {'mosaic': {'divisibility': 6}}


def test_factory_normalizes_native_id():
	# Arrange / Act:
	native_mosaic_info = create_native_mosaic_info(NETWORK_PROPERTIES, MOSAIC_DEFINITION)

	# Assert:
	assert NativeMosaicInfo('72c0212e67a08bce', 6) == native_mosaic_info
	assert '72C0212E67A08BCE' == native_mosaic_info.id
	assert 6 == native_mosaic_info.divisibility


def test_info_constructs_positionally():
	# Arrange / Act:
	native_mosaic_info = NativeMosaicInfo('72c0212e67a08bce', 6)

	# Assert:
	assert ('id', 'divisibility') == native_mosaic_info._fields
	assert '72C0212E67A08BCE' == native_mosaic_info.id
	assert 6 == native_mosaic_info.divisibility


def test_info_constructs_with_keywords():
	# Arrange:
	positional_info = NativeMosaicInfo('72c0212e67a08bce', 6)

	# Act:
	keyword_info = NativeMosaicInfo(id='72c0212e67a08bce', divisibility=6)

	# Assert:
	assert positional_info == keyword_info


def test_native_id_normalizes_lowercase():
	# Arrange / Act / Assert:
	assert '72C0212E67A08BCE' == normalize_native_mosaic_id('72c0212e67a08bce')


def test_native_id_normalizes_grouped():
	# Arrange / Act / Assert:
	assert '72C0212E67A08BCE' == normalize_native_mosaic_id("72c0'212e'67a0'8bce")


@pytest.mark.parametrize('mosaic_id', [
	'72C0212E67A08BC',
	'72C0212E67A08BCE0',
	'72C0212E67A08BCG',
	72
])
def test_native_id_rejects_malformed(mosaic_id):
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='Native mosaic id'):
		normalize_native_mosaic_id(mosaic_id)


def test_native_id_rejects_missing():
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='chain.currencyMosaicId'):
		extract_native_mosaic_id({'chain': {}})


@pytest.mark.parametrize('divisibility', [None, 6.0, '6'])
def test_divisibility_rejects_non_int(divisibility):
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='must be an integer'):
		normalize_native_mosaic_divisibility(divisibility)


def test_divisibility_rejects_bool():
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='must be an integer'):
		normalize_native_mosaic_divisibility(True)


@pytest.mark.parametrize('divisibility', [-1, MAX_NATIVE_MOSAIC_DIVISIBILITY + 1])
def test_divisibility_rejects_range(divisibility):
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='between 0 and 6'):
		normalize_native_mosaic_divisibility(divisibility)


def test_divisibility_accepts_limits():
	# Arrange / Act / Assert:
	assert 0 == normalize_native_mosaic_divisibility(0)
	assert MAX_NATIVE_MOSAIC_DIVISIBILITY == normalize_native_mosaic_divisibility(MAX_NATIVE_MOSAIC_DIVISIBILITY)


def test_info_is_immutable():
	# Arrange:
	native_mosaic_info = NativeMosaicInfo('72C0212E67A08BCE', 6)

	# Act / Assert:
	with pytest.raises(AttributeError):
		native_mosaic_info.id = '0000000000000000'


@pytest.mark.parametrize('response', [
	{},
	{'mosaic': {}},
	{'mosaic': {'divisibility': None}}
])
def test_factory_rejects_bad_response(response):
	# Arrange / Act / Assert:
	with pytest.raises(ValueError, match='Mosaic response|divisibility'):
		create_native_mosaic_info(NETWORK_PROPERTIES, response)
