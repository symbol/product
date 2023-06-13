from zenlog import log


def write_transaction_to_file(transaction, transaction_filepath):
	"""Writes a transaction to a file."""

	with open(transaction_filepath, 'wb') as outfile:
		outfile.write(transaction.serialize())

	transaction_filepath.chmod(0o600)

	log.info(_('transaction-serializer-saved-file').format(filepath=transaction_filepath))
	log.info(transaction)
