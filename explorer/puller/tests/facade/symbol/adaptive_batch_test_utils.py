from .puller_test_utils import create_node_block, create_node_transaction, create_transaction_page, statement_path, transaction_path


def create_adaptive_batch_fixture(
	total_transaction_counts,
	transaction_ranges,
	top_level_counts=None,
	transactions_by_height=None,
	failing_transaction_range=None
):
	"""Creates deterministic block and response pages for adaptive batch tests."""
	top_level_counts = top_level_counts or total_transaction_counts
	transactions_by_height = transactions_by_height or {}
	blocks = [
		create_node_block(
			height,
			transactions_count=top_level_counts[height - 1],
			total_transactions_count=total_transaction_counts[height - 1])
		for height in range(1, len(total_transaction_counts) + 1)
	]
	transactions_by_height = {
		height: list(transactions_by_height.get(height, []))
		for height in range(1, len(blocks) + 1)
	}
	for height, transaction_count in enumerate(top_level_counts, 1):
		if transactions_by_height[height]:
			continue

		transactions_by_height[height] = [
			create_node_transaction(
				height,
				transaction_hash=f'{height:060X}{index:04X}',
				transaction_id=f'transaction-{height}-{index}',
				block_index=index)
			for index in range(transaction_count)
		]

	transaction_pages = {}
	statement_pages = {}
	for start_height, end_height in transaction_ranges:
		transaction_pages[transaction_path(start_height, end_height)] = create_transaction_page([
			transaction
			for height in range(start_height, end_height + 1)
			for transaction in transactions_by_height[height]
		])
		statement_pages[statement_path(start_height, end_height)] = {'data': []}

	if failing_transaction_range is not None:
		transaction_pages[transaction_path(*failing_transaction_range)] = RuntimeError('adaptive transaction fetch failed')

	return blocks, transaction_pages, statement_pages
