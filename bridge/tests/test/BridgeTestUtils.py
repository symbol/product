import datetime

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from bridge.models.WrapRequest import WrapError, WrapRequest

HEIGHTS = [
	12345678905, 12345678901, 12345678903, 12345678902, 12345678999, 12345678990
]

HASHES = [  # sorted
	'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA', 'C16CF93C5A1B6620F3D4C7A7EAAE1990D9C2678775FBC18EAE577A78C8D52B25',
	'7D7EB08675D6F78FAB8E7D703994390DD95C6A9E8ADD18A9CF13CE4C632F8F01', '22DB80B584620906DF2BF5361B5A31D3CE0E78672CC4D31532C1043EAA1D5624',
	'11F5CA7ABAD2E90F398B9A976949E9765BBA966972ADE89649355004E8557432', '0A08FD582D7A9E9C0BE27AFEE461418D3F14E6C433E74CDB9103DB1DDE258597'
]

PUBLIC_KEYS = [
	'5C80309DD937ACB0869F1BEEDE14B552E02AEC4B3569E2E2E76477F84B7E3121', '5AA84DF43CD5173A79D91310CE2042434F8B4A7DA157CE3C9DE5C993AEC18293',
	'E3CCB9628EA0CE412BAF7E91B215E0645DC6B83D8CCEB3E849E51A3CF15B0A2F', '02028714E352FE1348AC40977F23B1954EAC5836B0BEDD2A5F26E34A83DB773D',
	'AF39DF4A01DA4DDB3545CB1694F71C5D0EB062048DA13ABA871D34BDB04BA715', '8BF684603E71F2680426E10F69E8074C685E180DDE62AC8A0D451037EA6B7BF1'
]

NEM_ADDRESSES = [
	'TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG', 'TA4FO6TJBIG3VODLUJTPYTJPXDOSTOFZKDGMXPZF', 'TA7TKNUYFE5BVW6HELM7GAUECYPQ6ATK5MR4DNQ5',
	'TB7GF436SYPM4UQF2YYI563QIETUO5NZR6EREKPI', 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B', 'TBKVLYR4DV523MTI4XPRHSP4TKP7C56VTLJ5LDKA'
]

SYMBOL_ADDRESSES = [
	'TA2C4L5FMQF6DPD2RNKDAU62TXZJSMTBN7G25ZA', 'TCMC3M2NP6EGY55SFVXAGILE2N6WLVPEQQDDYOA', 'TCCMDF6VL6YJUZWPTDY6VEBOXCS7GB344BKSGOI',
	'TDURL6ONOACEPE2E762XVDMRRPZQSAX7ZQAE22Q', 'TCKRDEYTT4ORA5WQD7S64CZFFLQBPEK4RBJMCWQ', 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI'
]


def make_request_error(index, message, **kwargs):
	height = kwargs.get('height', None) or HEIGHTS[index]
	transaction_hash = Hash256(HASHES[kwargs.get('hash_index', index)])
	transaction_subindex = kwargs.get('transaction_subindex', 0)
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	return WrapError(height, transaction_hash, transaction_subindex, address, message)


def make_request(index, **kwargs):
	height = kwargs.get('height', None) or HEIGHTS[index]
	transaction_hash = Hash256(HASHES[kwargs.get('hash_index', index)])
	transaction_subindex = kwargs.get('transaction_subindex', 0)
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])

	amount = kwargs.get('amount', height % 1000)
	if kwargs.get('destination_address'):
		destination_address = kwargs['destination_address']
	else:
		destination_public_key = PublicKey(PUBLIC_KEYS[kwargs.get('destination_address_index', index)])
		destination_address = f'0x{destination_public_key}'
	return WrapRequest(height, transaction_hash, transaction_subindex, address, amount, destination_address)


def make_wrap_error_from_request(request, message):
	return WrapError(
		request.transaction_height,
		request.transaction_hash,
		request.transaction_subindex,
		request.sender_address,
		message)


def change_request_amount(request, amount):
	return WrapRequest(
		request.transaction_height,
		request.transaction_hash,
		request.transaction_subindex,
		request.sender_address,
		amount,
		request.destination_address)


def change_request_destination_address(request, destination_address):
	return WrapRequest(
		request.transaction_height,
		request.transaction_hash,
		request.transaction_subindex,
		request.sender_address,
		request.amount,
		destination_address)


def assert_timestamp_within_last_second(timestamp):
	now = datetime.datetime.now(datetime.timezone.utc)
	assert (now - datetime.timedelta(seconds=1)).timestamp() <= timestamp <= now.timestamp()


def assert_equal_request(asserter, expected, actual):
	asserter.assertEqual(expected.transaction_height, actual.transaction_height)
	asserter.assertEqual(expected.transaction_hash, actual.transaction_hash)
	asserter.assertEqual(expected.transaction_subindex, actual.transaction_subindex)
	asserter.assertEqual(expected.sender_address, actual.sender_address)
	asserter.assertEqual(expected.amount, actual.amount)
	asserter.assertEqual(expected.destination_address, actual.destination_address)


def assert_wrap_request_success(asserter, result, expected_request):
	asserter.assertEqual(False, result.is_error)
	asserter.assertEqual(expected_request, result.request)
	asserter.assertEqual(None, result.error)


def assert_wrap_request_failure(asserter, result, expected_error):
	asserter.assertEqual(True, result.is_error)
	asserter.assertEqual(None, result.request)
	asserter.assertEqual(expected_error, result.error)
