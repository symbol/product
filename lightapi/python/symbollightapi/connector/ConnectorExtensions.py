async def get_incoming_transactions_from(connector, address, start_height):
	"""Uses the specified connector to retrieve all transactions sent an account at or after a specified block height."""

	start_id = None
	while True:
		transactions = await connector.incoming_transactions(address, start_id)
		if not transactions:
			return

		for transaction in transactions:
			if int(transaction['meta']['height']) < start_height:
				return

			yield transaction

		start_id = connector.extract_transaction_id(transactions[-1])
