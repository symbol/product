# NEM Test Wallet Data

Generated with the wallet/common/nem helper functions for testing only.
Do not use these credentials with real funds.

## Analysis

- `generateMnemonic()` creates a random BIP32 mnemonic using `symbol-sdk`.
- `createPrivateKeysFromMnemonic()` derives child private keys via the NEM facade BIP32 path for the requested network and indexes.
- `createWalletAccount()` derives the public key and address from each private key and returns wallet metadata without embedding the private key.

## Mnemonic

rocket bottom genius girl review brown among reduce ozone trip clock adapt able pave liquid tornado fence deal usual sample dad call coconut dizzy

## Testnet Private Keys

1. 82F165909C0AFDCFED2249D536BA2455EF65452FC4C23E64B74B5920A9852235
2. 49B4DBBFCFDE2C8BCE0E4A3758A545D1732933A9A4FB219024E34B92E95CE2B0
3. 83F03DF5207E10044E53F6E1F70C5255AFEA4A1A3D117AC0A0B931A3F526AD9E
4. 8C746D15C03229A4FE9A05D5494DF734AFC9797370BF354B62B2AADA7A2CE437
5. FFC4E5CE46021D36D107E380992ACA425FBC39A10FF0B2908DF57E86AD908F8D

## Testnet Wallet Accounts

```json
[
  {
    "index": 0,
    "address": "TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD",
    "publicKey": "F258E050E917F983C806EC3CB24409EC2417CA16D1AFF4E5A35A0813AFEB0820",
    "networkIdentifier": "testnet",
    "accountType": "mnemonic",
    "name": "Testnet Account 1"
  },
  {
    "index": 1,
    "address": "TCLGJSPIJK7U2AKMRXJ5CNWQQMLUZPXZUFFHCR2M",
    "publicKey": "BA366BEE38522CC7E3276312702200EC7216599690BE74DDCB60F9B90C8E20DB",
    "networkIdentifier": "testnet",
    "accountType": "mnemonic",
    "name": "Testnet Account 2"
  },
  {
    "index": 2,
    "address": "TAXGMIE2ZRJZ7US5U6Q75ECMRNOFLK35LKBOWV5C",
    "publicKey": "8A715BEC156C1490C769E31BA6288CF9074A4987B8F0D5095CEEA0460A60F74A",
    "networkIdentifier": "testnet",
    "accountType": "mnemonic",
    "name": "Testnet Account 3"
  },
  {
    "index": 3,
    "address": "TBGXJKHAZKZYBMA3QVL5G3B6SSMWH2YND273QVLJ",
    "publicKey": "EC513ACD2DBC96A94C09473C8C175C9E9FD52C8EF1EA082C22C211D60D8482BF",
    "networkIdentifier": "testnet",
    "accountType": "mnemonic",
    "name": "Testnet Account 4"
  },
  {
    "index": 4,
    "address": "TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR",
    "publicKey": "C8B81390399A3229DBF842991D29A5FD4F0D39DF6ECE793B8B7BB9A4F061AE45",
    "networkIdentifier": "testnet",
    "accountType": "mnemonic",
    "name": "Testnet Account 5"
  }
]
```

## Mainnet Private Keys

1. AEE207C36A02ACC1EE0F766E2EAD33F27DA20AB28EA755DD8F4B04496A61787B
2. 47DC25032AA1319233CE7135A2AEE2C478CEC76106E4A970F9DE38563011C764
3. E2674DB586EA75AC3FA97139BEF6927060C58A261F81F697469510C5D4018362
4. 228B3079170E5B97CA97B09C146248750C5F906BE01D79789FC23CA63A739498
5. BEA78A1F203945FBF4D2AF370767A8CA083E0BCB9C73A74C8E8CEB0C30E2FC93

## Mainnet Wallet Accounts

```json
[
  {
    "index": 0,
    "address": "NAZABXOOOCW72L42XSGUKV7VF4FIWK4MPY44VOIO",
    "publicKey": "98A13040E5080B57C8B24E3AD506CB54546074434EE24ABD8B30313F3A6090F4",
    "networkIdentifier": "mainnet",
    "accountType": "mnemonic",
    "name": "Mainnet Account 1"
  },
  {
    "index": 1,
    "address": "NBKHEUO5CIRPNE4OZHGBYSYMMSMJCIO57K2GX6PR",
    "publicKey": "2E74C294BF06886E7709515C660353AC9815820AAE492865DCC4F8584DEE4518",
    "networkIdentifier": "mainnet",
    "accountType": "mnemonic",
    "name": "Mainnet Account 2"
  },
  {
    "index": 2,
    "address": "NC6PTCR6QK4J7ZSWOO2NWOBYQ5L67YG7EHEUJ7GS",
    "publicKey": "90412170689AC9731ACC3B9FAC7B216264AFE9E482F152166D818DD051380532",
    "networkIdentifier": "mainnet",
    "accountType": "mnemonic",
    "name": "Mainnet Account 3"
  },
  {
    "index": 3,
    "address": "NC3EGXSS5ERQPYENW5UEFCT4PCPYR3OH5TJVYGLT",
    "publicKey": "6F057043279D8DFBD2C18752F3416FF069C120A7212C1EF98C2DF28950757D5B",
    "networkIdentifier": "mainnet",
    "accountType": "mnemonic",
    "name": "Mainnet Account 4"
  },
  {
    "index": 4,
    "address": "NCORNTEJFEM7QIECXTIG3NGT4NK4ORKDEMD3SANJ",
    "publicKey": "45376D18C3F2A02C5ABD4EE09C51FBBF6D5A1EE95050D7CA6BC38E1010FD6898",
    "networkIdentifier": "mainnet",
    "accountType": "mnemonic",
    "name": "Mainnet Account 5"
  }
]
```
