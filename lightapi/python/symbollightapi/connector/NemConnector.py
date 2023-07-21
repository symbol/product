from collections import namedtuple

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from ..model.Block import Block
from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from ..model.Transaction import CosignSignatureTransaction, TransactionFactory
from .BasicConnector import BasicConnector

Message = namedtuple('Message', ['payload', 'is_plain'])
Mosaic = namedtuple('Mosaic', ['namespace_name', 'quantity'])
Modification = namedtuple('Modification', ['modification_type', 'cosignatory_account'])
MosaicLevy = namedtuple('MosaicLevy', ['fee', 'recipient', 'type', 'namespace_name'])
MosaicProperties = namedtuple('MosaicProperties', ['divisibility', 'initial_supply', 'supply_mutable', 'transferable'])

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
		# blocks_after_dict = Blocks
		return [self._map_to_block(block) for block in blocks['data']]

	async def get_block(self, height):
		""""Gets Block data"""

		block = await self.post('local/block/at', {'height': height})
		# block_dict = Block_1
		return self._map_to_block(block)

	@staticmethod
	def _map_to_block(block_dict):
		block = block_dict['block']
		difficulty = block_dict['difficulty']
		block_hash = block_dict['hash']
		transactions = block_dict['txes']

		return Block(
			block['height'],
			block['timeStamp'],
			[
				NemConnector._map_to_transaction(transaction, False, block['height'])
				for transaction in transactions
			],
			difficulty,
			block_hash,
			block['signer'],
			block['signature'],
		)

	@staticmethod
	def _map_to_transaction(transaction, is_embedded=False, block_height=None):
		"""Maps a transaction dictionary to a transaction object."""

		tx_dict = transaction if is_embedded else transaction['tx']
		tx_type = tx_dict['type']

		# Define common arguments for all transactions
		common_args = {
			'transaction_hash': None if is_embedded else transaction['hash'],
			'height': None if is_embedded else block_height,
			'sender': tx_dict['signer'],
			'fee': tx_dict['fee'],
			'timestamp': tx_dict['timeStamp'],
			'deadline': tx_dict['deadline'],
			'signature': None if is_embedded else tx_dict['signature'],
		}

		specific_args = {}

		if TransactionType.TRANSFER.value == tx_type:
			message = tx_dict['message']

			if 'payload' in message and 'type' in message:
				message = Message(
					message['payload'],
					message['type']
				)

			mosaics = None
			if 'mosaics' in tx_dict:
				mosaics = [
					Mosaic(
						f'{mosaic["mosaicId"]["namespaceId"]}.{mosaic["mosaicId"]["name"]}',
						mosaic['quantity']
					)
					for mosaic in tx_dict['mosaics']
				]

			specific_args = {
				'amount': tx_dict['amount'],
				'recipient': tx_dict['recipient'],
				'message': message,
				'mosaics': mosaics,
			}
		elif TransactionType.ACCOUNT_KEY_LINK.value == tx_type:
			specific_args = {
				'mode': tx_dict['mode'],
				'remote_account': tx_dict['remoteAccount'],
			}
		elif TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value == tx_type:
			specific_args = {
				'min_cosignatories': tx_dict['minCosignatories']['relativeChange'],
				'modifications': [
					Modification(
						modification['modificationType'],
						modification['cosignatoryAccount'])
					for modification in tx_dict['modifications']
				]
			}
		elif TransactionType.MULTISIG_TRANSACTION.value == tx_type:
			specific_args = {
				'signatures': [
					CosignSignatureTransaction(
						signature['timeStamp'],
						signature['otherHash']['data'],
						signature['otherAccount'],
						signature['signer'],
						signature['fee'],
						signature['deadline'],
						signature['signature']
					)
					for signature in tx_dict['signatures']
				],
				'other_transaction': NemConnector._map_to_transaction(tx_dict['otherTrans'], True),
				'inner_hash': transaction['innerHash'],
			}
		elif TransactionType.NAMESPACE_REGISTRATION.value == tx_type:
			specific_args = {
				'rental_fee_sink': tx_dict['rentalFeeSink'],
				'rental_fee': tx_dict['rentalFee'],
				'parent': tx_dict['parent'],
				'namespace': tx_dict['newPart'],
			}
		elif TransactionType.MOSAIC_DEFINITION.value == tx_type:
			mosaic_definition = tx_dict['mosaicDefinition']
			mosaic_id = mosaic_definition['id']
			mosaic_levy = mosaic_definition['levy']
			mosaic_properties_dict = {
				item['name']: item['value']
				for item in mosaic_definition['properties']
			}

			specific_args = {
				'creation_fee': tx_dict['creationFee'],
				'creation_fee_sink': tx_dict['creationFeeSink'],
				'creator': mosaic_definition['creator'],
				'description': mosaic_definition['description'],
				'properties': MosaicProperties(
					int(mosaic_properties_dict['divisibility']),
					int(mosaic_properties_dict['initialSupply']),
					mosaic_properties_dict['supplyMutable'] != 'false',
					mosaic_properties_dict['transferable'] != 'false'
				),
				'levy': MosaicLevy(
					mosaic_levy['fee'],
					mosaic_levy['recipient'],
					mosaic_levy['type'],
					f'{mosaic_levy["mosaicId"]["namespaceId"]}.{mosaic_levy["mosaicId"]["name"] }'
				),
				'namespace_name': f'{mosaic_id["namespaceId"]}.{mosaic_id["name"] }'
			}
		elif TransactionType.MOSAIC_SUPPLY_CHANGE.value == tx_type:
			mosaic_id = tx_dict['mosaicId']

			specific_args = {
				'supply_type': tx_dict['supplyType'],
				'delta': tx_dict['delta'],
				'namespace_name': f'{mosaic_id["namespaceId"]}.{mosaic_id["name"] }',
			}

		return TransactionFactory.create_transaction(tx_type, common_args, specific_args)
