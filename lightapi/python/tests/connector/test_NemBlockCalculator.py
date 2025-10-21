from symbollightapi.connector.NemBlockCalculator import NemBlockCalculator

transaction_base = {
	"timeStamp": 0,
	"signature":
		"b45ccd08d758e6c968b5c7fbe0127f2885f5ab53719f61bb0ad512ecd8db82a1ac50020ad47b58e55af7feb97f7dd084531af1ac0fa6019825d0568060a63d0d",
	"fee": 0,
	"deadline": 0,
	"signer": "d8e06b38d4ce227fe735eb64bec55d6b9708cf91bcbcbe7e09f36ffd8b97763d"
}

cosignature_transaction = {
	**transaction_base,
	"otherHash": {
		"data": "5e29c5e77ec482afe2fc770a1d0d6a04205b75b854b8bbb9733e980f167f5eae"
	},
	"otherAccount": "TBLGATVTVML66WWPSUN5RWKWEBKCPNYLQVWLTLFS",
	"type": 4098,
	"version": -1744830463
}

# pylint: disable=invalid-name


def test_can_calculate_transfer_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"amount": 100000,
		"recipient": "TD3FGWIQR7GIOJSFG52JMCJYCVP2PC7ZNDZYDN4H",
		"type": 257,
		"message": {},
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 184 == transaction_size


def test_can_calculate_transfer_transaction_v2():
	# Arrange:
	tx_json = {
		**transaction_base,
		"amount": 100000,
		"recipient": "TDDRMIUIHSQIFPMIX4Z4FDBARSLVO5TASFV2UQSJ",
		"mosaics": [
			{
				"quantity": 199798819,
				"mosaicId": {
					"namespaceId": "testnam",
					"name": "token"
				}
			}
		],
		"type": 257,
		"message": {
			"payload": "313233",
			"type": 1
		},
		"version": -1744830462,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 235 == transaction_size


def test_can_calculate_account_key_link_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"mode": 1,
		"remoteAccount": "bb0e019d28df2d5241790c47a3ff99f39a1fc56017a1d291fb74fe6762d66aea",
		"type": 2049,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 168 == transaction_size


def test_can_calculate_multisig_account_modification_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"modifications": [
			{
				"modificationType": 1,
				"cosignatoryAccount": "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"
			}
		],
		"type": 4097,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 176 == transaction_size


def test_can_calculate_multisig_account_modification_transaction_v2():
	# Arrange:
	tx_json = {
		**transaction_base,
		"minCosignatories": {
			"relativeChange": 2
		},
		"modifications": [
			{
				"modificationType": 1,
				"cosignatoryAccount": "00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"
			}
		],
		"type": 4097,
		"version": -1744830462,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 184 == transaction_size


def test_can_calculate_namespace_registration_with_root_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"parent": None,
		"rentalFeeSink": "TD3FGWIQR7GIOJSFG52JMCJYCVP2PC7ZNDZYDN4H",
		"rentalFee": 100000000,
		"newPart": "root-namespace",
		"type": 8193,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 202 == transaction_size


def test_can_calculate_namespace_registration_with_sub_namespace_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"parent": "root-namespace",
		"rentalFeeSink": "TD3FGWIQR7GIOJSFG52JMCJYCVP2PC7ZNDZYDN4H",
		"rentalFee": 100000000,
		"newPart": "sub-namespace",
		"type": 8193,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 215 == transaction_size


def test_can_calculate_mosaic_definition_without_properties_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"creationFeeSink": "TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC",
		"creationFee": 100000000,
		"mosaicDefinition": {
			"creator": "55c9ad5388652e38a72a0f7792b6ee9091404680f864c908401734e98755c9b4",
			"description": "test mosaic",
			"id": {
				"namespaceId": "test_namespace_1",
				"name": "test_mosaic_2"
			},
			"properties": [],
			"levy": {}
		},
		"type": 16385,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 284 == transaction_size


def test_can_calculate_mosaic_definition_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"creationFeeSink": "TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC",
		"creationFee": 100000000,
		"mosaicDefinition": {
			"creator": "55c9ad5388652e38a72a0f7792b6ee9091404680f864c908401734e98755c9b4",
			"description": "test mosaic",
			"id": {
				"namespaceId": "test_namespace_1",
				"name": "test_mosaic_1"
			},
			"properties": [
				{
					"name": "divisibility",
					"value": "6"
				},
				{
					"name": "initialSupply",
					"value": "1000"
				},
				{
					"name": "supplyMutable",
					"value": "true"
				},
				{
					"name": "transferable",
					"value": "true"
				}
			],
			"levy": {
				"type": 1,
				"recipient": "TD3RXTHBLK6J3UD2BH2PXSOFLPWZOTR34WCG4HXH",
				"mosaicId": {
					"namespaceId": "nem",
					"name": "xem"
				},
				"fee": 1000
			}
		},
		"type": 16385,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 469 == transaction_size


def test_can_calculate_mosaic_supply_change_transaction_v1():
	# Arrange:
	tx_json = {
		**transaction_base,
		"mosaicId": {
			"namespaceId": "test_namespace_1",
			"name": "test_mosaic_1"
		},
		"supplyType": 1,
		"delta": 500,
		"type": 16386,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 181 == transaction_size


def test_can_calculate_cosignature_transaction_v1():
	# Arrange:
	tx_json = dict(cosignature_transaction)

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 212 == transaction_size


def test_can_calculate_multisig_transaction_v1():
	# Arrange:
	sig_tx_json = dict(cosignature_transaction)

	inner_tx_json = {
		"timeStamp": 314820082,
		"amount": 70000,
		"fee": 50000,
		"recipient": "TDPGL3LIAS5OPBMEJN63YRWS35HRQC6OC2523L5G",
		"mosaics": [],
		"type": 257,
		"deadline": 314821342,
		"message": {},
		"version": -1744830462,
		"signer": "0f83292a6f9b7882915df4f64f11bd20161eab4a56fb051678884e2400005df8"
	}

	tx_json = {
		**transaction_base,
		"otherTrans": inner_tx_json,
		"signatures": [
			sig_tx_json
		],
		"type": 4100,
		"version": -1744830463,
	}

	# Act:
	transaction_size = NemBlockCalculator.calculate_transaction_size(tx_json)

	# Assert:
	assert 472 == transaction_size
