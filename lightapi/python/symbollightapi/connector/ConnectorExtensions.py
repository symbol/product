async def get_incoming_transactions_from(connector, address, start_height=None, end_height=None):
	"""Uses the specified connector to retrieve all transactions sent to an account in the range [start_height, end_height)."""

	start_id = None
	while True:
		transactions_json = await connector.incoming_transactions(address, start_id)
		if not transactions_json:
			return

		for transaction_json in transactions_json:
			transaction_height = int(transaction_json['meta']['height'])
			if start_height and transaction_height < start_height:
				return

			if end_height and transaction_height >= end_height:
				continue

			yield transaction_json

		start_id = connector.extract_transaction_id(transactions_json[-1])
