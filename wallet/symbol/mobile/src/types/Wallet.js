/** @typedef {import('wallet-common-core').WalletController} WalletController */
/** @typedef {import('wallet-common-core').AddressBookModule} AddressBookModule */
/** @typedef {import('wallet-common-core').BridgeModule} BridgeModule */
/** @typedef {import('wallet-common-core').LocalizationModule} LocalizationModule */
/** @typedef {import('wallet-common-core').MarketModule} MarketModule */
/** @typedef {import('wallet-common-symbol').HarvestingModule} HarvestingModule */
/** @typedef {import('wallet-common-symbol').TransferModule} SymbolTransferModule */
/** @typedef {import('wallet-common-ethereum').TransferModule} EthereumTransferModule */
/** @typedef {import('wallet-common-symbol/src/types/Network').NetworkProperties} SymbolNetworkProperties */
/** @typedef {import('wallet-common-ethereum/src/types/Network').NetworkProperties} EthereumNetworkProperties */
/** @typedef {import('wallet-common-symbol/src/types/Account').AccountInfo} SymbolAccountInfo */
/** @typedef {import('wallet-common-ethereum/src/types/Account').AccountInfo} EthereumAccountInfo */

/**
 * @typedef {Object} MainWalletControllerModules
 * @property {AddressBookModule} addressBook
 * @property {HarvestingModule} harvesting
 * @property {LocalizationModule} localization
 * @property {MarketModule} market
 * @property {SymbolTransferModule} transfer
 * @property {BridgeModule} bridge
 */

/**
 * @typedef {Object} AdditionalWalletControllerModules
 * @property {EthereumTransferModule} transfer
 * @property {BridgeModule} bridge
 */

/**
 * @typedef {WalletController & {
 *   modules: MainWalletControllerModules,
 *   networkProperties: SymbolNetworkProperties,
 *   currentAccountInfo: SymbolAccountInfo | null
 * }} MainWalletController
 */

/**
 * @typedef {WalletController & {
 *   modules: AdditionalWalletControllerModules,
 *   networkProperties: EthereumNetworkProperties,
 *   currentAccountInfo: EthereumAccountInfo | null
 * }} AdditionalWalletController
 */


export {};
