import asyncio
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from ..model.Block import Block
from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from ..model.Transaction import TransactionFactory, TransactionHandler
from .BasicConnector import BasicConnector

MICROXEM_PER_XEM = 1000000


class NemAccountInfo:
	"""Represents a NEM account."""

	def __init__(self, address):
		"""Creates a NEM account."""

		self.address = address

		self.vested_balance = 0
		self.balance = 0
		self.public_key = None
		self.importance = 0
		self.harvested_blocks = 0

		self.remote_status = None


class NemConnector(BasicConnector):
	"""Async connector for interacting with a NEM node."""

	def __init__(self, endpoint, network=None):
		"""Creates a NEM async connector."""

		super().__init__(endpoint)
		self.network = network

	async def chain_height(self):
		"""Gets chain height."""

		chain_height = await self.get('chain/height', 'height')
		return int(chain_height)

	async def node_info(self):
		"""Gets node information."""

		node_dict = await self.get('node/info')
		node_info = self._map_to_node_info(node_dict)

		# lookup main account public key
		node_address = self.network.public_key_to_address(node_info.node_public_key)

		main_account_info = await self.account_info(node_address, forwarded=True)
		if 'ACTIVE' == main_account_info.remote_status:
			node_info.main_public_key = main_account_info.public_key
		else:
			node_info.main_public_key = node_info.node_public_key

		return node_info

	async def peers(self):
		"""Gets peer nodes information."""

		nodes_dict = await self.get('node/peer-list/reachable', 'data')
		return [self._map_to_node_info(node_dict) for node_dict in nodes_dict]

	async def account_info(self, address, forwarded=False):
		subpath = '/forwarded' if forwarded else ''
		response_dict = await self.get(f'account/get{subpath}?address={address}')

		account_dict = response_dict['account']
		account_info = NemAccountInfo(Address(account_dict['address']))
		account_info.vested_balance = account_dict['vestedBalance'] / MICROXEM_PER_XEM
		account_info.balance = account_dict['balance'] / MICROXEM_PER_XEM
		account_info.public_key = PublicKey(account_dict['publicKey']) if account_dict['publicKey'] else None
		account_info.importance = account_dict['importance']
		account_info.harvested_blocks = account_dict['harvestedBlocks']

		meta_dict = response_dict['meta']
		account_info.remote_status = meta_dict['remoteStatus']
		return account_info

	@staticmethod
	def _map_to_node_info(node_dict):
		endpoint_dict = node_dict['endpoint']
		return NodeInfo(
			node_dict['metaData']['networkId'],
			None,  # NEM does not have network generation hash seed
			None,
			PublicKey(node_dict['identity']['public-key']),
			Endpoint(endpoint_dict['protocol'], endpoint_dict['host'], endpoint_dict['port']),
			node_dict['identity']['name'],
			node_dict['metaData']['version'],
			NodeInfo.API_ROLE_FLAG)

	async def get_blocks_after(self, height):
		""""Gets Blocks data"""

		blocks = await self.post('local/chain/blocks-after', {'height': height})

		block_heights = [block['block']['height'] for block in blocks['data']]
		block_sizes = await asyncio.gather(*[self.get_block_size(height) for height in block_heights])

		for block, size in zip(blocks['data'], block_sizes):
			block['size'] = size

		return [self._map_to_block(block) for block in blocks['data']]

	async def get_block(self, height):
		""""Gets Block data"""

		block = await self.post('local/block/at', {'height': height})

		block_sizes = await self.get_block_size(height)
		block['size'] = block_sizes

		return self._map_to_block(block)

	async def get_block_size(self, height):
		""""Gets Block size"""

		block_size = await self.post('block/at/public', {'height': height}, response_type='binary')
		return len(block_size)

	def _map_to_block(self, block_dict):
		block = block_dict['block']
		difficulty = block_dict['difficulty']
		block_hash = block_dict['hash']
		transactions = block_dict['txes']
		size = block_dict['size']

		return Block(
			block['height'],
			block['timeStamp'],
			[
				self._map_to_transaction(transaction, block['height'])
				for transaction in transactions
			],
			difficulty,
			block_hash,
			block['signer'],
			block['signature'],
			size
		)

	@staticmethod
	def _map_to_transaction(transaction, block_height):
		"""Maps a transaction dictionary to a transaction object."""

		tx_dict = transaction['tx']
		tx_type = tx_dict['type']

		# Define common arguments for all transactions
		common_args = {
			'transaction_hash': transaction['hash'],
			'height': block_height,
			'sender': tx_dict['signer'],
			'fee': tx_dict['fee'],
			'timestamp': tx_dict['timeStamp'],
			'deadline': tx_dict['deadline'],
			'signature': tx_dict['signature'],
		}

		specific_args = {}

		if TransactionType.MULTISIG.value == tx_type:
			specific_args = TransactionHandler().map[tx_type](tx_dict, transaction['innerHash'])
		else:
			specific_args = TransactionHandler().map[tx_type](tx_dict)

		return TransactionFactory.create_transaction(tx_type, common_args, specific_args)
