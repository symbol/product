from datetime import datetime, timedelta

from symbolchain.CryptoTypes import PublicKey


class Block:
	NEM_EPOCH = datetime(2015, 3, 29, 0, 6, 25, 0)

	def __init__(self, height, timestamp, total_fees, total_transactions, difficulty, block_hash, signer):
		"""Create Block model."""

		# pylint: disable=too-many-arguments

		self.height = height
		self.timestamp = timestamp
		self.total_fees = total_fees
		self.total_transactions = total_transactions
		self.difficulty = difficulty
		self.block_hash = block_hash
		self.signer = signer

	@staticmethod
	def convert_timestamp_to_datetime(timestamp):
		return (Block.NEM_EPOCH + timedelta(seconds=timestamp)).strftime('%Y-%m-%d %H:%M:%S')

	@classmethod
	def from_nem_block_data(cls, block_data, nem_facade):
		block = block_data['block']
		transactions = block_data['txes']

		timestamp = cls.convert_timestamp_to_datetime(block['timeStamp'])
		total_fees = sum(tx['tx']['fee'] for tx in transactions)
		difficulty = f'{round(block_data["difficulty"] / (10 ** 14) * 100, 2):.2f}%'
		harvester = nem_facade.network.public_key_to_address(PublicKey(block['signer']))

		return cls(
			block['height'],
			timestamp,
			total_fees,
			len(transactions),
			difficulty,
			block_data['hash'],
			str(harvester)
		)

	def to_dict(self):
		return {
			'height': self.height,
			'timestamp': self.timestamp,
			'totalFees': self.total_fees,
			'totalTransactions': self.total_transactions,
			'difficulty': self.difficulty,
			'hash': self.block_hash,
			'signer': self.signer
		}
