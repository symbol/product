import asyncio
from binascii import hexlify
from collections import namedtuple

from aiolimiter import AsyncLimiter
from symbolchain.CryptoTypes import Hash256, PublicKey, Signature
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Address, NetworkTimestamp

from ..model.Block import Block
from ..model.Constants import DEFAULT_ASYNC_LIMITER_ARGUMENTS, TransactionStatus
from ..model.Endpoint import Endpoint
from ..model.Exceptions import NodeException, UnknownTransactionType
from ..model.NodeInfo import NodeInfo
from ..model.Transaction import (
	ConvertAccountToMultisigTransaction,
	CosignSignatureTransaction,
	ImportanceTransferTransaction,
	MosaicDefinitionTransaction,
	MosaicSupplyChangeTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	TransferTransaction
)
from .BasicConnector import BasicConnector

MosaicFeeInformation = namedtuple('MosaicFeeInformation', ['supply', 'divisibility'])
Message = namedtuple('Message', ['payload', 'is_plain'])
Mosaic = namedtuple('Mosaic', ['namespace_name', 'quantity'])
Modification = namedtuple('Modification', ['modification_type', 'cosignatory_account'])
MosaicLevy = namedtuple('MosaicLevy', ['fee', 'recipient', 'type', 'namespace_name'])
MosaicProperties = namedtuple('MosaicProperties', ['divisibility', 'initial_supply', 'supply_mutable', 'transferable'])

MICROXEM_PER_XEM = 1000000


# region NemAccountInfo

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

# endregion


class NemConnector(BasicConnector):
	"""Async connector for interacting with a NEM node."""

	def __init__(self, endpoint, network=None):
		"""Creates a NEM async connector."""

		super().__init__(endpoint)
		self.network = network

	# region extract_transaction_id, extract_block_timestamp

	@staticmethod
	def extract_transaction_id(transaction):
		"""Extracts the transaction id from a REST transaction JSON object."""

		return transaction['meta']['id']

	@staticmethod
	def extract_block_timestamp(block):
		"""Extracts the block timestamp from a REST block header JSON object."""

		return block['timeStamp']

	# endregion

	# region GET (chain_height, finalized_chain_height, network_time)

	async def chain_height(self):
		"""Gets chain height."""

		chain_height = await self.get('chain/height', 'height')
		return int(chain_height)

	async def finalized_chain_height(self):
		"""Gets finalized chain height."""

		return await self.chain_height() - 360

	async def network_time(self):
		"""Gets network time."""

		send_timestamp = await self.get('time-sync/network-time', 'sendTimeStamp')
		return NetworkTimestamp(int(send_timestamp // 1000))

	# endregion

	# region POST (block_headers)

	async def block_headers(self, height):
		"""Gets block headers."""

		url_path = 'block/at/public'
		block = await self.post(url_path, {'height': height})
		del block['transactions']
		return block

	# endregion

	# region GET (node_info)

	async def node_info(self):
		"""Gets node information."""

		node_json = await self.get('node/info')
		node_info = self._map_to_node_info(node_json)

		# lookup main account public key
		node_address = self.network.public_key_to_address(node_info.node_public_key)

		main_account_info = await self.account_info(node_address, forwarded=True)
		if 'ACTIVE' == main_account_info.remote_status:
			node_info.main_public_key = main_account_info.public_key
		else:
			node_info.main_public_key = node_info.node_public_key

		return node_info

	@staticmethod
	def _map_to_node_info(node_json):
		endpoint_json = node_json['endpoint']
		return NodeInfo(
			node_json['metaData']['networkId'],
			None,  # NEM does not have network generation hash seed
			None,
			PublicKey(node_json['identity']['public-key']),
			Endpoint(endpoint_json['protocol'], endpoint_json['host'], endpoint_json['port']),
			node_json['identity']['name'],
			node_json['metaData']['version'],
			NodeInfo.API_ROLE_FLAG)

	# endregion

	# region GET (peers)

	async def peers(self):
		"""Gets peer nodes information."""

		nodes_json = await self.get('node/peer-list/reachable', 'data')
		return [self._map_to_node_info(node_json) for node_json in nodes_json]

	# endregion

	# region GET (balance, account_info)

	async def balance(self, address, mosaic_id=None):
		"""Gets account balance for specified mosaic."""

		if not mosaic_id:
			response_json = await self.get(f'account/get?address={address}')
			return response_json['account']['balance']

		mosaics_json = await self.get(f'account/mosaic/owned?address={address}', 'data')
		mosaic_json = next((
			mosaic_json for mosaic_json in mosaics_json
			if (mosaic_json['mosaicId']['namespaceId'], mosaic_json['mosaicId']['name']) == mosaic_id
		), None)
		return mosaic_json['quantity'] if mosaic_json else 0

	async def account_info(self, address, forwarded=False):
		subpath = '/forwarded' if forwarded else ''
		response_json = await self.get(f'account/get{subpath}?address={address}')

		account_json = response_json['account']
		account_info = NemAccountInfo(Address(account_json['address']))
		account_info.vested_balance = account_json['vestedBalance'] / MICROXEM_PER_XEM
		account_info.balance = account_json['balance'] / MICROXEM_PER_XEM
		account_info.public_key = PublicKey(account_json['publicKey']) if account_json['publicKey'] else None
		account_info.importance = account_json['importance']
		account_info.harvested_blocks = account_json['harvestedBlocks']

		meta_json = response_json['meta']
		account_info.remote_status = meta_json['remoteStatus']
		return account_info

	# endregion

	# region GET (mosaic_fee_information)

	async def mosaic_fee_information(self, mosaic_id):
		"""Gets the information required to calculate the fee of the specified mosaic."""

		formatted_mosaic_id = f'{mosaic_id[0]}:{mosaic_id[1]}'
		supply = await self.get(f'mosaic/supply?mosaicId={formatted_mosaic_id}', 'supply')

		properties_json = await self.get(f'mosaic/definition?mosaicId={formatted_mosaic_id}', 'properties')
		divisibility_property_json = next(
			(property_json for property_json in properties_json if 'divisibility' == property_json['name']),
			None)
		divisibility = int(divisibility_property_json['value']) if divisibility_property_json else 0

		return MosaicFeeInformation(supply, divisibility)

	# endregion

	# region GET (filter_confirmed_transactions)

	async def filter_confirmed_transactions(self, transaction_hashes, async_limiter_arguments=DEFAULT_ASYNC_LIMITER_ARGUMENTS):
		"""Filters transaction hashes and returns only confirmed ones with (confirmed) heights."""

		limiter = AsyncLimiter(*async_limiter_arguments)

		async def get_transaction_hash_height_pair(transaction_hash):
			async with limiter:
				try:
					transaction_meta_json = await self.transaction_confirmed(transaction_hash)
					meta_json = transaction_meta_json['meta']
					return (Hash256(meta_json['hash']['data']), meta_json['height'])
				except NodeException:
					# not found is mapped to 400, so need to catch (and ignore) error
					return (None, 0)

		tasks = [get_transaction_hash_height_pair(transaction_hash) for transaction_hash in transaction_hashes]
		transaction_hash_height_pairs = await asyncio.gather(*tasks)

		return [
			transaction_hash_height_pair
			for transaction_hash_height_pair in transaction_hash_height_pairs
			if transaction_hash_height_pair[0]
		]

	# endregion

	# region GET (transaction_confirmed)

	async def transaction_confirmed(self, transaction_hash):
		"""Gets a confirmed transaction by hash."""

		url_path = f'transaction/get?hash={transaction_hash}'
		return await self.get(url_path, None)

	# endregion

	# region GET (incoming_transactions)

	async def incoming_transactions(self, address, start_id=None):
		"""Gets incoming transactions for the specified account."""

		return await self._transactions(address, 'incoming', start_id)

	async def _transactions(self, address, mode, start_id=None):
		url_path = f'account/transfers/{mode}?address={address}'
		if start_id:
			url_path += f'&id={start_id}'

		return await self.get(url_path, 'data')

	# endregion

	# region POST (announce_transaction)

	async def _announce_transaction(self, transaction_payload, url_path):
		"""Announces a transaction to the network."""

		if hasattr(transaction_payload, 'serialize'):
			transaction = transaction_payload
			signature = transaction.signature
			signing_payload = NemFacade.extract_signing_payload(transaction)
		else:
			# assume signature is prepended to signing_payload
			signature = Signature(transaction_payload[:Signature.SIZE])
			signing_payload = transaction_payload[Signature.SIZE:]

		return await self.post(url_path, {
			'data': hexlify(signing_payload).decode('utf8').upper(),
			'signature': str(signature)
		})

	async def announce_transaction(self, transaction_payload):
		"""Announces a transaction to the network."""

		response = await self._announce_transaction(transaction_payload, 'transaction/announce')
		if 'SUCCESS' != response['message']:
			raise NodeException(f'announce transaction failed {response}')

	# endregion

	# region try_wait_for_announced_transaction

	async def try_wait_for_announced_transaction(self, transaction_hash, desired_status, timeout_settings):
		"""Tries to wait for a previously announced transaction to transition to a desired status."""

		if TransactionStatus.UNCONFIRMED == desired_status:
			# announce would fail if a transaction is not unconfirmed
			return True

		for _ in range(timeout_settings.retry_count):
			try:
				await self.transaction_confirmed(transaction_hash)
				return True
			except NodeException:
				# ignore 400 not found errors (not_found_as_error will not work because these are not 404)
				await asyncio.sleep(timeout_settings.interval)

		return False

	# endregion

	# region POST (get_blocks_after, get_block)
	async def get_blocks_after(self, height):
		""""Gets Blocks data"""

		blocks_after_dict = await self.post('local/chain/blocks-after', {'height': height})
		# blocks_after_dict = Blocks
		return [self._map_to_block(block) for block in blocks_after_dict['data']]

	async def get_block(self, height):
		""""Gets Block data"""

		block_dict = await self.post('local/block/at', {'height': height})
		# block_dict = Block_1
		return self._map_to_block(block_dict)

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
				NemConnector._map_to_transaction(transaction['tx'], transaction['hash'], block['height'])
				for transaction in transactions
			],
			difficulty,
			block_hash,
			block['signer'],
			block['signature'],
		)

	# endregion


	@staticmethod
	def _map_to_transaction(tx_dict, tx_hash, block_height):
		"""Maps a transaction dictionary to a transaction object."""

		# Define a mapping from transaction types to constructor functions
		transaction_mapping = {
			257: TransferTransaction,
			2049: ImportanceTransferTransaction,
			4097: ConvertAccountToMultisigTransaction,
			4098: CosignSignatureTransaction,
			4100: MultisigTransaction,
			8193: NamespaceRegistrationTransaction,
			16385: MosaicDefinitionTransaction,
			16386: MosaicSupplyChangeTransaction,
		}

		tx_type = tx_dict['type']

		# Define common arguments for all transactions
		common_args = {
			'transaction_hash': tx_hash,
			'height': block_height,
			'sender': tx_dict['signer'],
			'fee': tx_dict['fee'],
			'timestamp': tx_dict['timeStamp'],
			'deadline': tx_dict['deadline'],
			'signature': tx_dict['signature'],
			'transaction_type': tx_dict['type'],
		}

		if tx_type in transaction_mapping:
			if tx_type == 257:
				payload = tx_dict['message']['payload']
				type = tx_dict['message']['type']

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
					'message': Message(payload, type),
					'mosaics': mosaics,
				}
			elif tx_type == 2049:
				specific_args = {
					'mode': tx_dict['mode'],
					'remote_account': tx_dict['remoteAccount'],
				}
			elif tx_type == 4097:
				specific_args = {
					'min_cosignatories': tx_dict['minCosignatories']['relativeChange'],
					'modifications': [
						Modification(
							modification['modificationType'],
							modification['cosignatoryAccount'])
						for modification in tx_dict['modifications']
					]
				}
			elif tx_type == 4100:
				# Todo: implement
				specific_args = {}
			elif tx_type == 8193:
				specific_args = {
					'rental_fee_sink': tx_dict['rentalFeeSink'],
					'rental_fee': tx_dict['rentalFee'],
					'parent': tx_dict['parent'],
					'namespace': tx_dict['newPart'],
				}
			elif tx_type == 16385:
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
			elif tx_type == 16386:
				mosaic_id = tx_dict['mosaicId']

				specific_args = {
					'supply_type': tx_dict['supplyType'],
					'delta': tx_dict['delta'],
					'namespace_name': f'{mosaic_id["namespaceId"]}.{mosaic_id["name"] }',
				}
			else:
				specific_args = {}

			return transaction_mapping[tx_type](**common_args, **specific_args)
		else:
			raise UnknownTransactionType(f'Unknown transaction type {tx_type}')
