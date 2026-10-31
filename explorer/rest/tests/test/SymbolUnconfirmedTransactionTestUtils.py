"""Node DTO fixtures for unconfirmed Symbol transactions."""

from copy import deepcopy

from symbolchain.sc import TransactionType


def create_meta_info(transaction_hash='AB' * 32):
	"""Creates common metadata for a top-level unconfirmed transaction."""

	return {
		'height': '0',
		'hash': transaction_hash,
		'merkleComponentHash': transaction_hash,
		'index': 0
	}


def create_embedded_meta_info(aggregate_hash, aggregate_id, index=0):
	"""Creates embedded metadata linked to its parent aggregate."""

	return {
		'height': '0',
		'aggregateHash': aggregate_hash,
		'aggregateId': aggregate_id,
		'index': index
	}


def create_embedded_transaction_info(transaction_type, **fields):
	"""Creates a transaction body without the top-level signing and fee fields."""

	return {
		'signerPublicKey': 'CA12DC4EE8B95DA4E3D6AD8FA3231A3B026381F4CF38E08DA98ADAD88625F99F',
		'version': 1,
		'network': 152,
		'type': transaction_type.value,
		**fields
	}


def create_transaction_info(transaction_type, **fields):
	"""Creates common top-level transaction fields with explicit type-specific fields."""

	return {
		**create_embedded_transaction_info(transaction_type),
		'signature': 'AB' * 64,
		'maxFee': '100000',
		'deadline': '123456789',
		**fields
	}


def get_unconfirmed_transaction_response():
	"""Returns a fresh flat search response with aggregate parents and separate child entries."""

	return deepcopy(_UNCONFIRMED_TRANSACTION_RESPONSE)


def get_unconfirmed_transaction(transaction_type):
	"""Returns the first fixture of a TransactionType, retaining embedded metadata when applicable."""

	for item_map in _UNCONFIRMED_TRANSACTION_RESPONSE:
		if item_map['transaction']['type'] == transaction_type.value:
			return deepcopy(item_map)

	raise ValueError(f'No unconfirmed transaction fixture for {transaction_type}')


def get_unconfirmed_aggregate_children(aggregate_hash):
	"""Returns separate child DTOs linked to the requested aggregate."""

	return [
		deepcopy(item_map) for item_map in _UNCONFIRMED_TRANSACTION_RESPONSE
		if item_map['meta'].get('aggregateHash') == aggregate_hash
	]


# Node DTO examples adapted from the wallet unconfirmed transaction fixture.
# Shared envelope fields use deterministic defaults; transaction-specific bodies remain explicit.
_UNCONFIRMED_TRANSACTION_RESPONSE = [
	{
		'meta': create_meta_info('01' * 32),
		'transaction': create_transaction_info(
			TransactionType.TRANSFER,
			size=176,
			recipientAddress='989222D2C5F190628F208EC652D921DECF679D51CA092A57',
			mosaics=[
				{
					'id': '72C0212E67A08BCE',
					'amount': '123000000'
				}
			]),
		'id': '6A0C0467FD8A987E1A0FF69D'
	},
	{
		'meta': create_meta_info('02' * 32),
		'transaction': create_transaction_info(
			TransactionType.AGGREGATE_BONDED,
			size=264,
			version=2,
			transactionsHash='2C03591ED233B317D8617565D7F75085E0710804EB836933171DDEBC3BBC4294',
			cosignatures=[]),
		'id': '6A94D544863647916806CF70'
	},
	{
		'meta': create_embedded_meta_info('02' * 32, '6A94D544863647916806CF70'),
		'transaction': create_embedded_transaction_info(
			TransactionType.TRANSFER,
			recipientAddress='989222D2C5F190628F208EC652D921DECF679D51CA092A57',
			mosaics=[
				{
					'id': '72C0212E67A08BCE',
					'amount': '5000000'
				}
			]),
		'id': '6A94D544863647916806CF71'
	},
	{
		'meta': create_meta_info('03' * 32),
		'transaction': create_transaction_info(
			TransactionType.NAMESPACE_REGISTRATION,
			size=152,
			registrationType=0,
			duration='86400',
			id='9B26A9460345E820',
			name='test--'),
		'id': '677D7D82F4ABCA49E62CAA17'
	},
	{
		'meta': create_meta_info('04' * 32),
		'transaction': create_transaction_info(
			TransactionType.ADDRESS_ALIAS,
			size=161,
			namespaceId='D748B092093AA7A1',
			aliasAction=1,
			address='982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6'),
		'id': '677D2F7BF4ABCA49E61FC32D'
	},
	{
		'meta': create_meta_info('05' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_ALIAS,
			size=145,
			namespaceId='D47D7DC85A201C13',
			aliasAction=1,
			mosaicId='699E9532708D2FB8'),
		'id': '677D29C3F4ABCA49E61D6D77'
	},
	{
		'meta': create_meta_info('06' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_DEFINITION,
			size=150,
			nonce=1308337564,
			id='0E2B031D9C83906D',
			flags=15,
			divisibility=4,
			duration='100'),
		'id': '677D3489F4ABCA49E620E270'
	},
	{
		'meta': create_meta_info('07' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_SUPPLY_CHANGE,
			size=145,
			mosaicId='0E2B031D9C83906D',
			action=1,
			delta='100000'),
		'id': '677D3489F4ABCA49E620E274'
	},
	{
		'meta': create_meta_info('08' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_SUPPLY_REVOCATION,
			size=168,
			sourceAddress='98127279F8DD1D6D91F9AAFB47F7567B5C885CFF0AFCCBCA',
			mosaicId='0E2B031D9C83906D',
			amount='1'),
		'id': '677D3489F4ABCA49E620E29E'
	},
	{
		'meta': create_meta_info('09' * 32),
		'transaction': create_transaction_info(
			TransactionType.AGGREGATE_COMPLETE,
			size=248,
			version=3,
			transactionsHash='B239D10DAECEEB7077E1F6942300916041E91CBEA7613B267BAF3D913CBE6A22',
			cosignatures=[]),
		'id': '677D29C3F4ABCA49E61D6DEA'
	},
	{
		'meta': create_embedded_meta_info('09' * 32, '677D29C3F4ABCA49E61D6DEA'),
		'transaction': create_embedded_transaction_info(
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION,
			minRemovalDelta=-1,
			minApprovalDelta=-1,
			addressAdditions=[],
			addressDeletions=[
				'98FF3719011226A1C6F1AD6B59B73F3F43FD0B31481E10C3'
			]),
		'id': '677D29C3F4ABCA49E61D6DEB'
	},
	{
		'meta': create_meta_info('0A' * 32),
		'transaction': create_transaction_info(
			TransactionType.HASH_LOCK,
			size=184,
			duration='5760',
			mosaicId='72C0212E67A08BCE',
			amount='10000000',
			hash='ADA2C97667D2D0C856E1EC5C5FC3236081C4ECE01AF7051B6CC5EBF9FAEAE6CB'),
		'id': '677D29C3F4ABCA49E61D6DE1'
	},
	{
		'meta': create_meta_info('0B' * 32),
		'transaction': create_transaction_info(
			TransactionType.SECRET_LOCK,
			size=209,
			duration='100',
			mosaicId='72C0212E67A08BCE',
			amount='100000000',
			hashAlgorithm=0,
			secret='5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F',
			recipientAddress='98127279F8DD1D6D91F9AAFB47F7567B5C885CFF0AFCCBCA'),
		'id': '677D29C3F4ABCA49E61D6DD9'
	},
	{
		'meta': create_meta_info('0C' * 32),
		'transaction': create_transaction_info(
			TransactionType.SECRET_PROOF,
			size=207,
			hashAlgorithm=0,
			secret='5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F',
			recipientAddress='98127279F8DD1D6D91F9AAFB47F7567B5C885CFF0AFCCBCA',
			proof='100C5F424FB6FE5F4A789A21CDD299E10D09EA5A'),
		'id': '677D29C3F4ABCA49E61D6DDD'
	},
	{
		'meta': create_meta_info('0D' * 32),
		'transaction': create_transaction_info(
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION,
			size=160,
			restrictionFlags=32769,
			restrictionAdditions=[],
			restrictionDeletions=[
				'98A451FE7871416BA7480FE338F08BCD6D7D6B1D83E0B6A8'
			]),
		'id': '677D2F7BF4ABCA49E61FC31F'
	},
	{
		'meta': create_meta_info('0E' * 32),
		'transaction': create_transaction_info(
			TransactionType.ACCOUNT_MOSAIC_RESTRICTION,
			size=144,
			restrictionFlags=32770,
			restrictionAdditions=[],
			restrictionDeletions=[
				'699E9532708D2FB8'
			]),
		'id': '677D29C3F4ABCA49E61D6D98'
	},
	{
		'meta': create_meta_info('0F' * 32),
		'transaction': create_transaction_info(
			TransactionType.ACCOUNT_OPERATION_RESTRICTION,
			size=138,
			restrictionFlags=49156,
			restrictionAdditions=[],
			restrictionDeletions=[
				16716
			]),
		'id': '677D29C3F4ABCA49E61D6D92'
	},
	{
		'meta': create_meta_info('10' * 32),
		'transaction': create_transaction_info(
			TransactionType.ACCOUNT_KEY_LINK,
			size=161,
			linkedPublicKey='F7D905E706693CAD93D176158A52F48196075D0D2B78123623B0CA184855E9DA',
			linkAction=0),
		'id': '677D413FF4ABCA49E623B137'
	},
	{
		'meta': create_meta_info('11' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_ADDRESS_RESTRICTION,
			size=184,
			mosaicId='1213766D49458631',
			restrictionKey='00000000000056CE',
			targetAddress='98FF3719011226A1C6F1AD6B59B73F3F43FD0B31481E10C3',
			previousRestrictionValue='30',
			newRestrictionValue='40'),
		'id': '677D29C9F4ABCA49E61D6E3D'
	},
	{
		'meta': create_meta_info('12' * 32),
		'transaction': create_transaction_info(
			TransactionType.MOSAIC_GLOBAL_RESTRICTION,
			size=170,
			mosaicId='1213766D49458631',
			referenceMosaicId='0000000000000000',
			restrictionKey='00000000000056CE',
			previousRestrictionValue='0',
			previousRestrictionType=0,
			newRestrictionValue='20',
			newRestrictionType=6),
		'id': '677D29C9F4ABCA49E61D6E33'
	},
	{
		'meta': create_meta_info('13' * 32),
		'transaction': create_transaction_info(
			TransactionType.AGGREGATE_COMPLETE,
			size=264,
			version=3,
			transactionsHash='F2B4E535B5F02DCE54C0D8774EC271495C7C751B2EE6551D6E5A4F36658C88B9',
			cosignatures=[]),
		'id': '677D29C3F4ABCA49E61D6D7C'
	},
	{
		'meta': create_embedded_meta_info('13' * 32, '677D29C3F4ABCA49E61D6D7C'),
		'transaction': create_embedded_transaction_info(
			TransactionType.ACCOUNT_METADATA,
			targetAddress='982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6',
			scopedMetadataKey='AB79F8932C207FF0',
			valueSizeDelta=8,
			valueSize=8,
			value='6D65746164617461'),
		'id': '677D29C3F4ABCA49E61D6D7D'
	},
	{
		'meta': create_meta_info('14' * 32),
		'transaction': create_transaction_info(
			TransactionType.AGGREGATE_COMPLETE,
			size=280,
			version=3,
			transactionsHash='D1D5F3C1BA3BA7FE04288311D3E2AE95CF6ABBD18FA125C5C7F641CFFA205869',
			cosignatures=[]),
		'id': '677D29C3F4ABCA49E61D6D83'
	},
	{
		'meta': create_embedded_meta_info('14' * 32, '677D29C3F4ABCA49E61D6D83'),
		'transaction': create_embedded_transaction_info(
			TransactionType.MOSAIC_METADATA,
			targetAddress='982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6',
			scopedMetadataKey='E58D01B9EFE794B0',
			targetMosaicId='699E9532708D2FB8',
			valueSizeDelta=15,
			valueSize=15,
			value='6D6F73616963206D65746164617461'),
		'id': '677D29C3F4ABCA49E61D6D84'
	},
	{
		'meta': create_meta_info('15' * 32),
		'transaction': create_transaction_info(
			TransactionType.AGGREGATE_COMPLETE,
			size=280,
			version=3,
			transactionsHash='C4B0BDC78E6A3C14942954D61F2FD98A0E09C8D3EAA50206E23FA56BE46E42D4',
			cosignatures=[]),
		'id': '677D29C3F4ABCA49E61D6D6D'
	},
	{
		'meta': create_embedded_meta_info('15' * 32, '677D29C3F4ABCA49E61D6D6D'),
		'transaction': create_embedded_transaction_info(
			TransactionType.NAMESPACE_METADATA,
			targetAddress='982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6',
			scopedMetadataKey='A7BA0DDE53F20693',
			targetNamespaceId='D47D7DC85A201C13',
			valueSizeDelta=18,
			valueSize=18,
			value='6E616D657370616365206D65746164617461'),
		'id': '677D29C3F4ABCA49E61D6D6E'
	},
	{
		'meta': create_meta_info('16' * 32),
		'transaction': create_transaction_info(
			TransactionType.VRF_KEY_LINK,
			size=161,
			linkedPublicKey='D7EC9E0D284AEC0ED01AF09E286EA2F6D02B39F2CC95AB872687185C085C1BF6',
			linkAction=0),
		'id': '677D413FF4ABCA49E623B128'
	},
	{
		'meta': create_meta_info('17' * 32),
		'transaction': create_transaction_info(
			TransactionType.VOTING_KEY_LINK,
			size=169,
			linkedPublicKey='1410185FF4E7CBC7A4F4D080CB6F5B3DC0553BB163A63EB6B90318A2077D10C5',
			startEpoch=100,
			endEpoch=150,
			linkAction=0),
		'id': '677D29C3F4ABCA49E61D6DBE'
	},
	{
		'meta': create_meta_info('18' * 32),
		'transaction': create_transaction_info(
			TransactionType.NODE_KEY_LINK,
			size=161,
			linkedPublicKey='7D484DAD2B7D8B8F5E7DD52D29E338C5C5D7A7FBF065297A2A7902AD237616B9',
			linkAction=0),
		'id': '677D413FF4ABCA49E623B0E3'
	}
]
