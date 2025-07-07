import asyncio

from symbolchain.CryptoTypes import Hash256

from symbollightapi.connector.ConnectorExtensions import filter_finalized_transactions, get_incoming_transactions_from

from ..test.LightApiTestUtils import HASHES

# region MockConnector


class MockConnector:
	def __init__(self, incoming_transactions_map=None, finalized_chain_height=None, status_start_height=None):
		self._incoming_transactions_map = incoming_transactions_map
		self._finalized_chain_height = finalized_chain_height
		self._status_start_height = status_start_height

	@staticmethod
	def extract_transaction_id(transaction):
		return transaction['meta']['id']

	async def finalized_chain_height(self):
		await asyncio.sleep(0.01)
		return self._finalized_chain_height

	async def incoming_transactions(self, address, start_id=None):
		await asyncio.sleep(0.01)
		return self._incoming_transactions_map[(address, start_id)]

	async def filter_confirmed_transactions(self, transaction_hashes):
		await asyncio.sleep(0.01)
		return [(transaction_hash, self._status_start_height + i) for i, transaction_hash in enumerate(transaction_hashes)]

# endregion


# pylint: disable=invalid-name


# region get_incoming_transactions_from

def _make_transaction_template_from_height(height):
	transaction_json = {'meta': {'height': height}}
	if 0 == height % 25:
		transaction_json['meta']['id'] = (height // 25) * (height // 25)

	return transaction_json


async def test_get_incoming_transactions_from_can_return_none():
	# Arrange:
	connector = MockConnector({
		('foo_address', None): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address')]

	# Assert:
	assert [] == transactions


async def _assert_get_incoming_transactions_from_can_complete_in_single_remote_call(expected_returned_heights, **kwargs):
	# Arrange:
	connector = MockConnector({
		('foo_address', None): [_make_transaction_template_from_height(height) for height in [176, 130, 125, 101, 100, 99, 75]],
		('foo_address', 9): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', **kwargs)]

	# Assert:
	assert [_make_transaction_template_from_height(height) for height in expected_returned_heights] == transactions


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call():
	await _assert_get_incoming_transactions_from_can_complete_in_single_remote_call([176, 130, 125, 101, 100, 99, 75])


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call_with_start_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_single_remote_call([176, 130, 125, 101, 100], start_height=100)


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call_with_end_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_single_remote_call([100, 99, 75], end_height=101)


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call_with_start_and_end_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_single_remote_call([125, 101, 100], start_height=100, end_height=130)


async def _assert_get_incoming_transactions_from_can_complete_in_multiple_remote_calls(expected_returned_heights, **kwargs):
	# Arrange:
	connector = MockConnector({
		('foo_address', None): [_make_transaction_template_from_height(height) for height in [176, 130, 125]],
		('foo_address', 25): [_make_transaction_template_from_height(height) for height in [101, 100]],
		('foo_address', 16): [_make_transaction_template_from_height(height) for height in [99, 75]],
		('foo_address', 9): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', **kwargs)]

	# Assert:
	assert [_make_transaction_template_from_height(height) for height in expected_returned_heights] == transactions


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls():
	await _assert_get_incoming_transactions_from_can_complete_in_multiple_remote_calls([176, 130, 125, 101, 100, 99, 75])


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls_with_start_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_multiple_remote_calls([176, 130, 125, 101, 100], start_height=100)


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls_with_end_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_multiple_remote_calls([100, 99, 75], end_height=101)


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls_with_start_and_end_height_filter():
	await _assert_get_incoming_transactions_from_can_complete_in_multiple_remote_calls([125, 101, 100], start_height=100, end_height=130)


async def test_get_incoming_transactions_from_supports_string_heights_and_ids():
	# Arrange:
	def _make_transaction_template_from_height_str(height):
		transaction_json = _make_transaction_template_from_height(height)
		transaction_json['meta']['height'] = str(transaction_json['meta']['height'])
		if 'id' in transaction_json['meta']:
			transaction_json['meta']['id'] = str(transaction_json['meta']['id'])

		return transaction_json

	connector = MockConnector({
		('foo_address', None): [_make_transaction_template_from_height_str(height) for height in [176, 130, 125, 101, 100, 99, 75]],
		('foo_address', '9'): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address')]

	# Assert:
	assert [_make_transaction_template_from_height_str(height) for height in [176, 130, 125, 101, 100, 99, 75]] == transactions

# endregion


# region filter_finalized_transactions

async def test_filter_finalized_transactions_can_return_none():
	# Arrange: no confirmed transactions are finalized
	connector = MockConnector(finalized_chain_height=10000, status_start_height=10100)

	# Act:
	transaction_hashes = await filter_finalized_transactions(connector, [Hash256(HASHES[i]) for i in (0, 2, 1)])

	# Assert:
	assert [] == transaction_hashes


async def test_filter_finalized_transactions_can_return_some():
	# Arrange: some confirmed transactions are finalized
	connector = MockConnector(finalized_chain_height=10000, status_start_height=9999)

	# Act:
	transaction_hashes = await filter_finalized_transactions(connector, [Hash256(HASHES[i]) for i in (0, 2, 1)])

	# Assert:
	assert 2 == len(transaction_hashes)
	assert (Hash256(HASHES[0]), 9999) == transaction_hashes[0]
	assert (Hash256(HASHES[2]), 10000) == transaction_hashes[1]


async def test_filter_finalized_transactions_can_return_all():
	# Arrange: all confirmed transactions are finalized
	connector = MockConnector(finalized_chain_height=10000, status_start_height=9998)

	# Act:
	transaction_hashes = await filter_finalized_transactions(connector, [Hash256(HASHES[i]) for i in (0, 2, 1)])

	# Assert:
	assert 3 == len(transaction_hashes)
	assert (Hash256(HASHES[0]), 9998) == transaction_hashes[0]
	assert (Hash256(HASHES[2]), 9999) == transaction_hashes[1]
	assert (Hash256(HASHES[1]), 10000) == transaction_hashes[2]

# endregion
