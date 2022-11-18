import { deleteUserPinCode } from '@haskkor/react-native-pincode';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { ExtendedKey, MnemonicPassPhrase, Network, Wallet } from 'symbol-hd-wallets';

export const generateMnemonic = () => {
    return MnemonicPassPhrase.createRandom().plain;
}

export const createPrivateKeyFromMnemonic = (index, mnemonic, networkIdentifier) => {
    const pathTestnet = `m/44'/1'/${index}'/0'/0'`;
    const pathMainnet = `m/44'/4343'/${index}'/0'/0'`;
    
    const mnemonicPassPhrase = new MnemonicPassPhrase(mnemonic);
    const seed = mnemonicPassPhrase.toSeed().toString('hex');
    const curve = Network.SYMBOL;
    const extendedKey = ExtendedKey.createFromSeed(seed, curve);
    const wallet = new Wallet(extendedKey);
    const path = networkIdentifier === 'mainnet' ? pathMainnet : pathTestnet;
    
    return wallet.getChildAccountPrivateKey(path);
}

export const clearCache = () => {
    SecureStorage.removeAll();
    PersistentStorage.removeAll();
    deleteUserPinCode();
}
