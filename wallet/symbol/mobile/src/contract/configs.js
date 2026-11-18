/** @typedef {import('@/contract/types/Contract').RequiredModule} RequiredModule */

/**
 * Required list of configs expected for each brand.
 * Component, screens and other customization configs.
 * @type {RequiredModule[]}
 */
export const requiredConfigs = [
	{ 
		path: 'config/account-avatar-config', 
		exportName: 'accountAvatarConfig', 
		typeName: 'AccountAvatarConfig' 
	},
	{ 
		path: 'config/actions-screen-config', 
		exportName: 'actionsScreenConfig', 
		typeName: 'ActionsScreenConfig' 
	},
	{ 
		path: 'config/address-book-widget-config', 
		exportName: 'addressBookWidgetConfig', 
		typeName: 'AddressBookWidgetConfig' 
	},
	{ 
		path: 'config/button-config', 
		exportName: 'buttonConfig', 
		typeName: 'ButtonConfig' 
	},
	{ 
		path: 'config/create-wallet-screen-config', 
		exportName: 'createWalletScreenConfig', 
		typeName: 'CreateWalletScreenConfig' 
	},
	{ 
		path: 'config/fee-selector-config', 
		exportName: 'feeSelectorConfig', 
		typeName: 'FeeSelectorConfig' 
	},
	{ 
		path: 'config/history-screen-config', 
		exportName: 'historyScreenConfig', 
		typeName: 'HistoryScreenConfig' 
	},
	{ 
		path: 'config/home-screen-config', 
		exportName: 'homeScreenConfig', 
		typeName: 'HomeScreenConfig' 
	},
	{ 
		path: 'config/icon-config', 
		exportName: 'iconConfig', 
		typeName: 'IconConfig' 
	},
	{ 
		path: 'config/import-wallet-screen-config', 
		exportName: 'importWalletScreenConfig', 
		typeName: 'ImportWalletScreenConfig'
	},
	{ 
		path: 'config/mnemonic-view-config', 
		exportName: 'mnemonicViewConfig', 
		typeName: 'MnemonicViewConfig' 
	},
	{ 
		path: 'config/send-receive-buttons-config', 
		exportName: 'sendReceiveButtonsConfig', 
		typeName: 'SendReceiveButtonsConfig' 
	},
	{ 
		path: 'config/status-card-config', 
		exportName: 'statusCardConfig', 
		typeName: 'StatusCardConfig' 
	},
	{ 
		path: 'config/token-avatar-config', 
		exportName: 'tokenAvatarConfig', 
		typeName: 'TokenAvatarConfig' 
	},
	{ 
		path: 'config/token-details-screen-config', 
		exportName: 'tokenDetailsScreenConfig', 
		typeName: 'TokenDetailsScreenConfig' 
	}
];
