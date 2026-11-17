import { bridges } from './bridge';
import { ethereumWalletController } from './ethereum/controller';
import { symbolWalletController } from './symbol/controller';
import { requestCache } from '../cache';
import { setupCacheInvalidation } from '../cache/setup-cache-invalidation';

const walletControllers = {
	main: symbolWalletController,
	additional: [
		ethereumWalletController
	]
};

setupCacheInvalidation(requestCache, { symbolWalletController, ethereumWalletController });


export default symbolWalletController;
export {
	symbolWalletController,
	ethereumWalletController,
	walletControllers,
	bridges
};


