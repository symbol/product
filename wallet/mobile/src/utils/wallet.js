// import Clipboard from '@react-native-community/clipboard';
import { Clipboard, PermissionsAndroid, Platform } from 'react-native'; // Remove after fix https://github.com/react-native-clipboard/clipboard/issues/71
import { deleteUserPinCode } from '@haskkor/react-native-pincode';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { ExtendedKey, MnemonicPassPhrase, Network, Wallet } from 'symbol-hd-wallets';
import { SymbolPaperWallet } from 'symbol-wallets-lib';
import RNFetchBlob from 'rn-fetch-blob';
import { Buffer } from 'buffer';
import { networkIdentifierToNetworkType } from './network';

export const generateMnemonic = () => {
    return MnemonicPassPhrase.createRandom().plain;
}

export const createPrivateKeysFromMnemonic = (mnemonic, indexes, networkIdentifier) => {
    const mnemonicPassPhrase = new MnemonicPassPhrase(mnemonic);
    const seed = mnemonicPassPhrase.toSeed().toString('hex');
    const curve = Network.SYMBOL;
    const extendedKey = ExtendedKey.createFromSeed(seed, curve);
    const wallet = new Wallet(extendedKey);
    
    const privateKeys = indexes.map((index) => {
        const pathTestnet = `m/44'/1'/${index}'/0'/0'`;
        const pathMainnet = `m/44'/4343'/${index}'/0'/0'`;
        const path = networkIdentifier === 'mainnet' ? pathMainnet : pathTestnet;

        return wallet.getChildAccountPrivateKey(path);
    });

    return privateKeys;
}

export const clearCache = () => {
    SecureStorage.removeAll();
    PersistentStorage.removeAll();
    deleteUserPinCode();
}

export const copyToClipboard = str => {
    Clipboard.setString(str);
};

export const downloadPaperWallet = async (mnemonic, rootAccount, networkIdentifier) => {
    const hdRootAccount = {
        mnemonic: mnemonic,
        rootAccountPublicKey: rootAccount.publicKey,
        rootAccountAddress: rootAccount.address,
    };

    const paperWallet = new SymbolPaperWallet(
        hdRootAccount,
        [],
        networkIdentifierToNetworkType(networkIdentifier),
        // TODO: add generation hash seed
    );

    const paperWalletPdf = await paperWallet.toPdf();
    const paperWalletBase64 = Buffer.from(paperWalletPdf).toString('base64');
    const uniqueValue = new Date().getTime().toString().slice(9);
    const filename = `symbol-wallet-${uniqueValue}.pdf`;
    await writeFile(paperWalletBase64, filename, 'base64')
}

export const requestAndroidWritePermission = async () => {
    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const isPermissionAlreadyGranted = await PermissionsAndroid.check(permission);

    if (isPermissionAlreadyGranted) {
        return true;
    }

    let isPermissionGranted;

    try {
        const result = await PermissionsAndroid.request(permission);
        isPermissionGranted = result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
        isPermissionGranted = false;
    }

    if (!isPermissionGranted) {
        throw Error('error_permission_denied_write_storage');
    }

    return true;
};

export const writeFile = async (data, filename, encoding) => {
    const { dirs } = RNFetchBlob.fs;
    const destinationDirectory = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
    const path = `${destinationDirectory}/${filename}`;

    if (Platform.OS === 'android') {
        await requestAndroidWritePermission();
    }
    
    try {
        await RNFetchBlob.fs.writeFile(path, data, encoding);

        if (Platform.OS === 'ios') {
            RNFetchBlob.ios.previewDocument(path);
        }
    }
    catch(e) {
        throw Error('error_failed_write_file');
    }
            
    return true;
};
