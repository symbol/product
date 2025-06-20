import asyncio

from symbollightapi.connector.ConnectorExtensions import get_incoming_transactions_from


class MockConnector:
	def __init__(self, incoming_transactions_map):
		self.incoming_transactions_map = incoming_transactions_map

	@staticmethod
	def extract_transaction_id(transaction):
		return transaction['meta']['id']

	async def incoming_transactions(self, address, start_id=None):
		await asyncio.sleep(0.01)
		return self.incoming_transactions_map[(address, start_id)]


# pylint: disable=invalid-name


# region get_incoming_transactions_from

async def test_get_incoming_transactions_from_can_return_none():
	# Arrange:
	connector = MockConnector({
		('foo_address', None): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', 100)]

	# Assert:
	assert [] == transactions


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call():
	# Arrange:
	connector = MockConnector({
		('foo_address', None): [{'meta': {'height': height}} for height in [175, 125, 101, 100, 99, 75]]
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', 100)]

	# Assert:
	assert [{'meta': {'height': height}} for height in [175, 125, 101, 100]] == transactions


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls():
	# Arrange:
	connector = MockConnector({
		('foo_address', None): [{'meta': {'height': 175}}, {'meta': {'height': 125, 'id': 4}}],
		('foo_address', 4): [{'meta': {'height': 101}}, {'meta': {'height': 100, 'id': 9}}],
		('foo_address', 9): [{'meta': {'height': 99}}, {'meta': {'height': 75}}]
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', 100)]

	# Assert:
	assert [
		{'meta': {'height': 175}}, {'meta': {'height': 125, 'id': 4}}, {'meta': {'height': 101}}, {'meta': {'height': 100, 'id': 9}}
	] == transactions


async def test_get_incoming_transactions_from_supports_string_heights():
	# Arrange:
	connector = MockConnector({
		('foo_address', None): [{'meta': {'height': str(height)}} for height in [175, 125, 101, 100, 99, 75]]
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(connector, 'foo_address', 100)]

	# Assert:
	assert [{'meta': {'height': str(height)}} for height in [175, 125, 101, 100]] == transactions

# endregion
