import re
from decimal import Decimal

from symbolchain.CryptoTypes import PublicKey
from symbolchain.symbol.Network import Address

from rest.model.symbol.format import format_amount
from rest.model.symbol.validation import SymbolDataInvalid

ACCOUNT_TYPE_VALUES = frozenset(['unlinked', 'main', 'remote', 'remoteUnlinked'])
HEX_64_PATTERN = re.compile(r'[0-9A-Fa-f]{64}', re.ASCII)
MOSAIC_ID_PATTERN = re.compile(r'[0-9A-Fa-f]{16}', re.ASCII)
DECIMAL_INTEGER_PATTERN = re.compile(r'[0-9]+', re.ASCII)
UINT32_MAX = 4294967295
UINT64_MAX = 18446744073709551615
INT64_MAX = 9223372036854775807
INT32_MAX = 2147483647


def _invalid(field_path, reason):
	return SymbolDataInvalid(field_path, reason)


def _bytes(value, field_path, expected_length):
	if value is None:
		raise _invalid(field_path, 'value is required')
	if not isinstance(value, (bytes, bytearray, memoryview)):
		raise _invalid(field_path, 'value is not bytes')

	try:
		result = bytes(value)
	except (TypeError, ValueError) as error:
		raise _invalid(field_path, 'value is not bytes') from error

	if len(result) != expected_length:
		raise _invalid(field_path, 'invalid byte length')

	return result


def _address(value, network, field_path):
	address_bytes = _bytes(value, field_path, Address.SIZE)
	address = Address(address_bytes)
	if not network.is_valid_address(address):
		raise _invalid(field_path, 'invalid address')

	return str(address)


def _public_key_address(value, network, field_path):
	public_key_bytes = _bytes(value, field_path, PublicKey.SIZE)
	return str(network.public_key_to_address(PublicKey(public_key_bytes)))


def _integer(value, field_path, minimum, maximum):
	if isinstance(value, bool):
		raise _invalid(field_path, 'value is not an integer')
	if isinstance(value, int):
		result = value
	elif isinstance(value, str) and DECIMAL_INTEGER_PATTERN.fullmatch(value):
		try:
			result = int(value)
		except ValueError as error:
			raise _invalid(field_path, 'value is not an integer') from error
	else:
		raise _invalid(field_path, 'value is not an integer')
	if result < minimum or result > maximum:
		raise _invalid(field_path, 'integer is outside the allowed range')

	return result


def _database_integer(value, field_path, minimum, maximum):
	if isinstance(value, bool) or not isinstance(value, int):
		raise _invalid(field_path, 'value is not an integer')

	if value < minimum or value > maximum:
		raise _invalid(field_path, 'integer is outside the allowed range')

	return value


def _required(mapping, key, field_path):
	if not isinstance(mapping, dict) or key not in mapping or mapping[key] is None:
		raise _invalid(field_path, 'value is required')

	return mapping[key]


def _finite_ratio(value, field_path):
	if isinstance(value, bool) or not isinstance(value, (Decimal, float, int)):
		raise _invalid(field_path, 'value is not a finite number')
	ratio = Decimal(str(value))
	if not ratio.is_finite() or ratio < 0 or ratio > 1:
		raise _invalid(field_path, 'value is outside the allowed range')

	return float(ratio)


def _hex_public_key(value, field_path):
	if not isinstance(value, str) or not HEX_64_PATTERN.fullmatch(value):
		raise _invalid(field_path, 'invalid public key')

	return value.upper()


def _mosaic_id(value, field_path):
	if not isinstance(value, str) or not MOSAIC_ID_PATTERN.fullmatch(value):
		raise _invalid(field_path, 'invalid mosaic id')

	return value.upper()


def _array(value, field_path):
	if not isinstance(value, list):
		raise _invalid(field_path, 'value is not an array')

	return value


def _account_identity(account, network):
	address = _address(account.address, network, 'accounts.address')
	public_key = None if account.public_key is None else _bytes(account.public_key, 'accounts.public_key', PublicKey.SIZE).hex().upper()
	account_type = account.account_type
	if account_type is not None and (not isinstance(account_type, str) or account_type not in ACCOUNT_TYPE_VALUES):
		raise _invalid('accounts.account_type', 'unknown account type')

	return address, public_key, account_type


class SymbolAccountView:
	"""Formats one Symbol current-state account detail response."""

	def __init__(self, account, network, native_mosaic_info):
		self.account = account
		self.network = network
		self.native_mosaic_info = native_mosaic_info

	def to_dict(self):
		"""Returns the documented Account detail DTO."""

		account = self.account
		address, public_key, account_type = _account_identity(account, self.network)
		address_height = None if account.address_height is None else _database_integer(
			account.address_height, 'accounts.address_height', 0, INT64_MAX)

		return {
			'address': address,
			'publicKey': public_key,
			'description': None,
			'namespaces': _namespaces(account.alias_names),
			'balance': _balance(account.mosaics, self.native_mosaic_info),
			'importance': _finite_ratio(account.importance_percentage, 'accounts.importance_percentage'),
			'accountType': account_type,
			'isHarvestingActive': None,
			'mosaics': _mosaics(account.mosaics, address, self.network, self.native_mosaic_info),
			'supplementalKeys': {
				'linked': _supplemental_key(account.linked_public_key, self.network, 'accounts.linked_public_key'),
				'node': _supplemental_key(account.node_public_key, self.network, 'accounts.node_public_key'),
				'vrf': _supplemental_key(account.vrf_public_key, self.network, 'accounts.vrf_public_key')
			},
			'votingKeys': _voting_keys(account.voting_public_keys, account.finalized_epoch),
			'importanceHistory': _importance_history(account.activity_buckets, self.native_mosaic_info),
			'isMultisig': False,
			'cosignatories': [],
			'cosignatoryOf': [],
			'height': address_height,
			'harvestedBlocks': None,
			'harvestedFees': None,
			'minCosignatories': 0,
			'remoteAddress': None
		}


class SymbolAccountListView:
	"""Formats one snapshot-backed Symbol account list response."""

	def __init__(self, account, network, native_mosaic_info):
		self.account = account
		self.network = network
		self.native_mosaic_info = native_mosaic_info

	def to_dict(self):
		"""Returns the documented Account list DTO."""

		account = self.account
		address, public_key, account_type = _account_identity(account, self.network)
		mosaics = _mosaics(account.mosaics, address, self.network, self.native_mosaic_info)
		balance = next((mosaic['amount'] for mosaic in mosaics if mosaic['id'] == account.balance_mosaic_id), 0)

		return {
			'address': address,
			'publicKey': public_key,
			'accountType': account_type,
			'importance': _finite_ratio(account.importance_percentage, 'accounts.importance_percentage'),
			'balance': balance,
			'namespaces': _namespaces(account.namespaces),
			'mosaics': mosaics,
			'description': None,
			'isHarvestingActive': None
		}


class SymbolMultisigView:
	"""Formats one Symbol current-state multisig response."""

	def __init__(self, multisig, network):
		self.multisig = multisig
		self.network = network

	def to_dict(self):
		"""Returns the documented Multisig DTO."""

		cosignatories = _addresses(self.multisig.cosignatory_addresses, self.network, 'multisig.cosignatory_addresses')
		multisig_addresses = _addresses(self.multisig.multisig_addresses, self.network, 'multisig.multisig_addresses')
		if not cosignatories and not multisig_addresses:
			return None

		if not cosignatories:
			min_approval = None
			min_removal = None
		else:
			min_approval = _database_integer(self.multisig.min_approval, 'multisig.min_approval', 0, INT32_MAX)
			min_removal = _database_integer(self.multisig.min_removal, 'multisig.min_removal', 0, INT32_MAX)

		return {
			'minApproval': min_approval,
			'minRemoval': min_removal,
			'cosignatoryAddresses': cosignatories,
			'multisigAddresses': multisig_addresses
		}


def _namespaces(alias_names):
	if alias_names is None or not isinstance(alias_names, (list, tuple)) or any(not isinstance(name, str) for name in alias_names):
		raise _invalid('symbol_alias_names.account', 'value is not a string array')

	return list(alias_names)


def _supplemental_key(value, network, field_path):
	if value is None:
		return None

	return _public_key_address(value, network, field_path)


def _balance(mosaics, native_mosaic_info):
	if not isinstance(mosaics, (list, tuple)):
		raise _invalid('account_mosaics', 'value is not an array')
	for index, mosaic in enumerate(mosaics):
		if not hasattr(mosaic, 'mosaic_id'):
			raise _invalid(f'account_mosaics[{index}]', 'value is not a mosaic row')
		if _mosaic_id(mosaic.mosaic_id, 'account_mosaics.mosaic_id') == native_mosaic_info.id:
			amount = _database_integer(mosaic.amount, 'account_mosaics.amount', 0, INT64_MAX)
			return format_amount(amount, native_mosaic_info.divisibility)

	return 0


def _mosaics(mosaics, account_address, network, native_mosaic_info):
	result = []
	for index, mosaic in enumerate(mosaics):
		field_path = f'account_mosaics[{index}]'
		if not isinstance(mosaic.alias_names, (list, tuple)) or any(not isinstance(alias, str) for alias in mosaic.alias_names):
			raise _invalid(f'{field_path}.alias_names', 'value is not a string array')
		mosaic_id = _mosaic_id(mosaic.mosaic_id, f'{field_path}.mosaic_id')
		amount = _database_integer(mosaic.amount, f'{field_path}.amount', 0, INT64_MAX)
		name = mosaic.alias_names[0] if mosaic.alias_names else mosaic_id
		if mosaic.metadata_mosaic_id is None:
			divisibility = native_mosaic_info.divisibility if mosaic_id == native_mosaic_info.id else 0
			is_created_by_account = False
		else:
			divisibility = _database_integer(mosaic.divisibility, f'{field_path}.divisibility', 0, 255)
			is_created_by_account = _address(mosaic.owner_address, network, f'{field_path}.owner_address') == account_address
		result.append({
			'id': mosaic_id,
			'name': name,
			'amount': format_amount(amount, divisibility),
			'isCreatedByAccount': is_created_by_account
		})

	return result


def _voting_keys(voting_public_keys, finalized_epoch):
	if finalized_epoch is None:
		raise _invalid('sync_state.finalized_epoch', 'value is required')

	finalized = _database_integer(finalized_epoch, 'sync_state.finalized_epoch', 0, INT32_MAX)
	keys = _array(voting_public_keys, 'accounts.voting_public_keys')
	result = []
	for index, voting_key in enumerate(keys):
		field_path = f'accounts.voting_public_keys[{index}]'
		public_key = _hex_public_key(_required(voting_key, 'publicKey', f'{field_path}.publicKey'), f'{field_path}.publicKey')
		start_epoch = _integer(_required(voting_key, 'startEpoch', f'{field_path}.startEpoch'), f'{field_path}.startEpoch', 1, UINT32_MAX)
		end_epoch = _integer(_required(voting_key, 'endEpoch', f'{field_path}.endEpoch'), f'{field_path}.endEpoch', 1, UINT32_MAX)
		if end_epoch < start_epoch:
			raise _invalid(f'{field_path}.endEpoch', 'epoch range is reversed')

		status = 'future' if finalized < start_epoch else 'current' if finalized <= end_epoch else 'expired'
		result.append({
			'publicKey': public_key,
			'startEpoch': start_epoch,
			'endEpoch': end_epoch,
			'status': status
		})

	return result


def _importance_history(activity_buckets, native_mosaic_info):
	buckets = _array(activity_buckets, 'accounts.activity_buckets')
	result = []
	for index, bucket in enumerate(buckets):
		field_path = f'accounts.activity_buckets[{index}]'
		start_height = _integer(_required(bucket, 'startHeight', f'{field_path}.startHeight'), f'{field_path}.startHeight', 0, UINT64_MAX)
		total_fees = _integer(_required(bucket, 'totalFeesPaid', f'{field_path}.totalFeesPaid'), f'{field_path}.totalFeesPaid', 0, UINT64_MAX)
		beneficiary_count = _integer(
			_required(bucket, 'beneficiaryCount', f'{field_path}.beneficiaryCount'),
			f'{field_path}.beneficiaryCount', 0, UINT32_MAX)
		raw_score = _integer(_required(bucket, 'rawScore', f'{field_path}.rawScore'), f'{field_path}.rawScore', 0, UINT64_MAX)
		result.append({
			'recalculationBlock': start_height,
			'totalFeesPaid': format_amount(total_fees, native_mosaic_info.divisibility),
			'beneficiaryCount': beneficiary_count,
			'importanceScore': raw_score
		})

	return result


def _addresses(values, network, field_path):
	if values is None or not isinstance(values, list):
		raise _invalid(field_path, 'value is not an address array')

	return [_address(value, network, f'{field_path}[{index}]') for index, value in enumerate(values)]
