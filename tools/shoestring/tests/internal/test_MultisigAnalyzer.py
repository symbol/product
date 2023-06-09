import pytest
from symbolchain.symbol.Network import Address
from symbollightapi.connector.SymbolConnector import MultisigInfo

from shoestring.internal.MultisigAnalyzer import calculate_min_cosignatures_count

ADDRESS_1 = Address('TBTB2IZRF4YQM3FFFGH5IUZQDSJQKU2SR77A74I')
ADDRESS_2 = Address('TC7MJBBN52IT4434YJT5TBHV7TEVLSMBFENTSNQ')
ADDRESS_3 = Address('TDJVZT3GHVQ4MTTLBA6ARMKUJQ6ZKOHLAE3JESA')
ADDRESS_4 = Address('TCMW6PBD3XSCLDU5HYHQXZF25VEDODFG5XL52LA')  # multisig with cosigners { 1, 2, 3 }
ADDRESS_5 = Address('TB54C4RPIF6JHOUAYQQSVIHEMIP3LMMFKDGECAY')  # multisig with cosigners { 4 }


class MockConnector:
	@staticmethod
	async def account_multisig(address):
		if ADDRESS_4 == address:
			return MultisigInfo(2, 3, [ADDRESS_1, ADDRESS_2, ADDRESS_3], [])
		if ADDRESS_5 == address:
			return MultisigInfo(1, 1, [ADDRESS_4], [])

		return MultisigInfo(0, 0, [], [])


# pylint: disable=invalid-name


async def test_can_calculate_min_cosignatures_count_for_normal_account():
	# Act:
	min_cosignatures_count = await calculate_min_cosignatures_count(MockConnector(), ADDRESS_1)

	# Assert:
	assert 0 == min_cosignatures_count


async def test_can_calculate_min_cosignatures_count_for_single_level_multisig_account():
	# Act:
	min_cosignatures_count = await calculate_min_cosignatures_count(MockConnector(), ADDRESS_4)

	# Assert:
	assert 2 == min_cosignatures_count


async def test_cannot_calculate_min_cosignatures_count_for_multi_level_multisig_account():
	# Act + Assert:
	with pytest.raises(RuntimeError):
		await calculate_min_cosignatures_count(MockConnector(), ADDRESS_5)
