def calculate_transfer_transaction_fee(xem_amount, message=None):
	"""Calculates a transfer transaction fee given the amount of XEM (whole units) and message to send."""

	message_fee = 0 if not message else len(message) // 32 + 1
	transfer_fee = min(25, max(1, xem_amount // 10_000))
	return 50_000 * (message_fee + transfer_fee)
