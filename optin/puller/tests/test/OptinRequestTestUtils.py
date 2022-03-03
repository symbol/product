from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address

from puller.models.OptinRequest import OptinRequest, OptinRequestError

HEIGHTS = [
	12345678905, 12345678901, 12345678903
]


HASHES = [  # sorted
	'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA', 'C16CF93C5A1B6620F3D4C7A7EAAE1990D9C2678775FBC18EAE577A78C8D52B25',
	'7D7EB08675D6F78FAB8E7D703994390DD95C6A9E8ADD18A9CF13CE4C632F8F01'
]


PUBLIC_KEYS = [
	'5C80309DD937ACB0869F1BEEDE14B552E02AEC4B3569E2E2E76477F84B7E3121', '5AA84DF43CD5173A79D91310CE2042434F8B4A7DA157CE3C9DE5C993AEC18293',
	'E3CCB9628EA0CE412BAF7E91B215E0645DC6B83D8CCEB3E849E51A3CF15B0A2F', '02028714E352FE1348AC40977F23B1954EAC5836B0BEDD2A5F26E34A83DB773D',
	'AF39DF4A01DA4DDB3545CB1694F71C5D0EB062048DA13ABA871D34BDB04BA715'
]


NEM_ADDRESSES = [
	'TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG', 'TA4FO6TJBIG3VODLUJTPYTJPXDOSTOFZKDGMXPZF', 'TA7TKNUYFE5BVW6HELM7GAUECYPQ6ATK5MR4DNQ5',
	'TB7GF436SYPM4UQF2YYI563QIETUO5NZR6EREKPI', 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B'
]


SYMBOL_ADDRESSES = [
	'NCU36L7K7B4I5JP5HHROFVFZYSCKKXWQI6PDT6I', 'NCLAZCJ36LUDVHNYZPWN67NI4V5E6VZJNZ666XY', 'NBLVHBI6VOMCI4QV53ZCKV5IRM7ZKCAYZYBECXQ',
	'NCRCD5QSQYXPOFGJS7KJFUKROMHJZLX3JWUEOLY'
]


def make_request_error(index, message, **kwargs):
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	transaction_hash = Hash256(HASHES[kwargs.get('hash_index', index)])
	return OptinRequestError(address, kwargs.get('height', None) or HEIGHTS[index], transaction_hash, message)


def make_request(index, message_dict, **kwargs):
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	transaction_hash = Hash256(HASHES[kwargs.get('hash_index', index)])
	return OptinRequest(address, kwargs.get('height', None) or HEIGHTS[index], transaction_hash, message_dict)


def assert_equal_request(asserter, expected, actual, is_error=False):
	asserter.assertEqual(expected.address, actual.address)
	asserter.assertEqual(expected.transaction_height, actual.transaction_height)
	asserter.assertEqual(expected.transaction_hash, actual.transaction_hash)
	asserter.assertEqual(expected.destination_public_key, actual.destination_public_key)
	asserter.assertEqual(expected.multisig_public_key, actual.multisig_public_key)
	asserter.assertEqual(is_error, actual.is_error)
