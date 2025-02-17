import { AddressBookModule } from 'src/lib/controller/modules/AddressBookModule';
import { HarvestingModule } from 'src/lib/controller/modules/HarvestingModule';
import { MarketModule } from 'src/lib/controller/modules/MarketModule';
import { TransferModule } from 'src/lib/controller/modules/TransferModule';
import { WalletController } from 'src/lib/controller/WalletController';
import { PersistentStorage, SecureStorage } from 'src/lib/storage';

const MobileWalletController = new WalletController({
    persistentStorage: PersistentStorage,
    secureStorage: SecureStorage,
    isObservable: true,
    modules: [AddressBookModule, HarvestingModule, MarketModule, TransferModule],
});

export default MobileWalletController;
