import { bridges } from './bridge';
import { ethereumWalletController } from './ethereum/controller';
import { symbolWalletController } from './symbol/controller';

const walletControllers = {
	main: symbolWalletController,
	additional: [
		ethereumWalletController
	]
};


export default symbolWalletController;
export {
	symbolWalletController,
	ethereumWalletController,
	walletControllers,
	bridges
};


