from binascii import hexlify, unhexlify
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.symbol.Network import Address, NetworkTimestamp

from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from .BasicConnector import BasicConnector

ChainStatistics = namedtuple('ChainStatistics', ['height', 'score_high', 'score_low'])
FinalizationStatistics = namedtuple('FinalizationStatistics', ['epoch', 'point', 'height', 'hash'])
MultisigInfo = namedtuple('MultisigInfo', ['min_approval', 'min_removal', 'cosignatory_addresses', 'multisig_addresses'])
VotingPublicKey = namedtuple('VotingPublicKey', ['start_epoch', 'end_epoch', 'public_key'])


def _is_not_found(response_json):
	return 'code' in response_json and 'ResourceNotFound' == response_json['code']


# region LinkedPublicKeys

class LinkedPublicKeys:
	"""Collection of public keys linked to an account."""

	def __init__(self):
		self.linked_public_key = None
		self.vrf_public_key = None
		self.voting_public_keys = []

# endregion


class SymbolConnector(BasicConnector):
	"""Async connector for interacting with a Symbol node."""

	def __init__(self, endpoint):
		"""Creates a Symbol async connector."""

		super().__init__(endpoint)
		self._network_properties = None

	# region extract_transaction_id

	@staticmethod
	def extract_transaction_id(transaction):
		"""Extracts the transaction id from a REST transaction JSON object."""

		return transaction['id']

	# endregion

	# region GET (currency_mosaic_id)

	async def currency_mosaic_id(self):
		"""Gets the currency mosaic id from the network."""

		if not self._network_properties:
			self._network_properties = await self.get('network/properties')

		formatted_currency_mosaic_id = self._network_properties['chain']['currencyMosaicId']
		return int(formatted_currency_mosaic_id.replace('\'', ''), 16)

	# endregion

	# region GET (chain_height, chain_statistics, finalized_chain_height, finalization_statistics, network_time)

	async def chain_height(self):
		"""Gets chain height."""

		chain_statistics = await self.chain_statistics()
		return chain_statistics.height

	async def chain_statistics(self):
		"""Gets chain statistics."""

		chain_statistics = await self.get('chain/info')
		return ChainStatistics(*(int(chain_statistics[key]) for key in ('height', 'scoreHigh', 'scoreLow')))

	async def finalized_chain_height(self):
		"""Gets finalized chain height."""

		finalization_statistics = await self.finalization_statistics()
		return finalization_statistics.height

	async def finalization_statistics(self):
		"""Gets finalization statistics."""

		finalization_statistics = await self.get('chain/info', 'latestFinalizedBlock')
		return FinalizationStatistics(
			*(int(finalization_statistics[key]) for key in ('finalizationEpoch', 'finalizationPoint', 'height')),
			Hash256(finalization_statistics['hash']))

	async def network_time(self):
		"""Gets network time."""

		timestamps = await self.get('node/time')
		return NetworkTimestamp(int(timestamps['communicationTimestamps']['sendTimestamp']))

	# endregion

	# region GET (node_info)

	async def node_info(self):
		"""Gets node information."""

		node_json = await self.get('node/info')
		return self._map_to_node_info(node_json)

	@staticmethod
	def _map_to_node_info(node_json):
		# TODO_: need to detect HTTPS somehow

		node_port = 3000 if node_json['roles'] & NodeInfo.API_ROLE_FLAG else node_json['port']
		return NodeInfo(
			node_json['networkIdentifier'],
			Hash256(node_json['networkGenerationHashSeed']),
			PublicKey(node_json['publicKey']),
			PublicKey(node_json['nodePublicKey']) if 'nodePublicKey' in node_json else None,
			Endpoint('http', node_json['host'], node_port),
			node_json['friendlyName'],
			SymbolConnector._format_symbol_version(node_json['version']),
			node_json['roles'])

	@staticmethod
	def _format_symbol_version(version):
		version_parts = [(version >> 24) & 0xFF, (version >> 16) & 0xFF, (version >> 8) & 0xFF, version & 0xFF]
		return '.'.join(str(version_part) for version_part in version_parts)

	# endregion

	# region GET (peers)

	async def peers(self):
		"""Gets peer nodes information."""

		nodes_json = await self.get('node/peers')
		return [self._map_to_node_info(node_json) for node_json in nodes_json]

	# endregion

	# region GET (balance)

	async def balance(self, account_id, mosaic_id):
		"""Gets account balance for specified mosaic."""

		json_account = await self.get(f'accounts/{account_id}', 'account')
		json_mosaic = next((json_mosaic for json_mosaic in json_account['mosaics'] if json_mosaic['id'] == mosaic_id), None)
		return int(json_mosaic['amount']) if json_mosaic else 0

	# endregion

	# region GET (account_links)

	async def account_links(self, account_id):
		"""Gets account links for a specified account."""

		response_json = await self.get(f'accounts/{account_id}', not_found_as_error=False)
		if _is_not_found(response_json):
			return LinkedPublicKeys()

		return self._parse_links(response_json['account']['supplementalPublicKeys'])

	@staticmethod
	def _parse_links(supplemental_public_keys_json):
		links = LinkedPublicKeys()
		if 'linked' in supplemental_public_keys_json:
			links.linked_public_key = PublicKey(supplemental_public_keys_json['linked']['publicKey'])

		if 'vrf' in supplemental_public_keys_json:
			links.vrf_public_key = PublicKey(supplemental_public_keys_json['vrf']['publicKey'])

		if 'voting' in supplemental_public_keys_json:
			links.voting_public_keys = [
				VotingPublicKey(
					voting_public_key_json['startEpoch'],
					voting_public_key_json['endEpoch'],
					PublicKey(voting_public_key_json['publicKey']))
				for voting_public_key_json in supplemental_public_keys_json['voting']['publicKeys']
			]

		return links

	# endregion

	# region GET (account_multisig)

	async def account_multisig(self, address):
		"""Gets multisig information about an account."""

		response_json = await self.get(f'account/{address}/multisig', not_found_as_error=False)
		if _is_not_found(response_json):
			return MultisigInfo(0, 0, [], [])

		multisig_json = response_json['multisig']
		return MultisigInfo(
			multisig_json['minApproval'],
			multisig_json['minRemoval'],
			[self._decoded_string_to_address(decoded_address) for decoded_address in multisig_json['cosignatoryAddresses']],
			[self._decoded_string_to_address(decoded_address) for decoded_address in multisig_json['multisigAddresses']])

	@staticmethod
	def _decoded_string_to_address(decoded_address):
		return Address(unhexlify(decoded_address))

	# endregion

	# region POST (transaction_statuses)

	async def transaction_statuses(self, transaction_hashes):
		"""Gets the statuses of the specified transactions."""

		request = {'hashes': [str(transaction_hash) for transaction_hash in transaction_hashes]}
		return await self.post('transactionStatus', request)

	# endregion

	# region GET (transaction_confirmed)

	async def transaction_confirmed(self, transaction_hash):
		"""Gets a confirmed transaction by hash."""

		url_path = f'transactions/confirmed/{transaction_hash}'
		return await self.get(url_path, None)

	# endregion

	# region GET (incoming_transactions)

	async def incoming_transactions(self, address, start_id=None):
		"""Gets incoming transactions for the specified account."""

		return await self._transactions(f'recipientAddress={address}', start_id)

	async def _transactions(self, query_filter, start_id=None):
		url_path = f'transactions/confirmed?{query_filter}&embedded=true&pageSize=100&order=desc'
		if start_id:
			url_path += f'&offset={start_id}'

		transactions = await self.get(url_path, 'data')
		return transactions

	# endregion

	# region PUT (announce_transaction, announce_partial_transaction)

	async def _announce_transaction(self, transaction_payload, url_path):
		"""Announces a transaction to the network."""

		if hasattr(transaction_payload, 'serialize'):
			transaction_buffer = transaction_payload.serialize()
		else:
			transaction_buffer = transaction_payload

		hex_payload = hexlify(transaction_buffer).decode('utf8').upper()
		await self.put(url_path, {
			'payload': hex_payload
		})

	async def announce_transaction(self, transaction_payload):
		"""Announces a transaction to the network."""

		await self._announce_transaction(transaction_payload, 'transactions')

	async def announce_partial_transaction(self, transaction_payload):
		"""Announces a partial transaction to the network."""

		await self._announce_transaction(transaction_payload, 'transactions/partial')

	# endregion
