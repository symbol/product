import { AddressBookModule } from '@/app/lib/controller/modules/AddressBookModule';
import { HarvestingModule } from '@/app/lib/controller/modules/HarvestingModule';
import { MarketModule } from '@/app/lib/controller/modules/MarketModule';
import { TransferModule } from '@/app/lib/controller/modules/TransferModule';
import { WalletController } from '@/app/lib/controller/WalletController';
import { PersistentStorage, SecureStorage } from '@/app/lib/storage';

const MobileWalletController = new WalletController({
    persistentStorage: PersistentStorage,
    secureStorage: SecureStorage,
    isObservable: true,
    modules: [AddressBookModule, HarvestingModule, MarketModule, TransferModule],
});

export default MobileWalletController;
