import { ethereumWalletController } from './ethereum-wallet-controller';
import { symbolWalletController } from './symbol-wallet-controller';

const walletControllers = {
	main: symbolWalletController,
	additional: [
		ethereumWalletController
	]
};

export {
	symbolWalletController,
	ethereumWalletController,
	walletControllers
};
