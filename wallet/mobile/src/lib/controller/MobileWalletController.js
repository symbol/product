import { AddressBookModule } from '@/app/lib/controller/modules/AddressBookModule';
import { HarvestingModule } from '@/app/lib/controller/modules/HarvestingModule';
import { MarketModule } from '@/app/lib/controller/modules/MarketModule';
import { TransferModule } from '@/app/lib/controller/modules/TransferModule';
import { WalletController } from '@/app/lib/controller/WalletController';
import { PersistentStorage, SecureStorage } from '@/app/lib/storage';

/**
 * @typedef {Object} MobileWalletControllerModules
 * @property {AddressBookModule} addressBook - The address book module.
 * @property {HarvestingModule} harvesting - The module that handles harvesting information and operations.
 * @property {MarketModule} market - The module that handles market information.
 * @property {TransferModule} transfer - The module that handles transfer transaction operations.
 */
const modules = [AddressBookModule, HarvestingModule, MarketModule, TransferModule];

/**
 * Mobile wallet controller.
 * @type {WalletController & { modules: MobileWalletControllerModules }}
 */
const MobileWalletController = /** @type {any} */ (
    new WalletController({
        persistentStorage: PersistentStorage,
        secureStorage: SecureStorage,
        isObservable: true,
        modules,
    })
);

export default MobileWalletController;
