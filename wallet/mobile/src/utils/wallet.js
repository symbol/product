// import Clipboard from '@react-native-community/clipboard';
import { Clipboard, PermissionsAndroid } from 'react-native'; // Remove after fix https://github.com/react-native-clipboard/clipboard/issues/71
import { deleteUserPinCode } from '@haskkor/react-native-pincode';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { ExtendedKey, MnemonicPassPhrase, Network, Wallet } from 'symbol-hd-wallets';
import { SymbolPaperWallet } from 'symbol-wallets-lib';
import RNFetchBlob from 'rn-fetch-blob';
import { networkIdentifierToNetworkType } from './network';

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

export const copyToClipboard = str => {
    Clipboard.setString(str);
};

export const downloadPaperWallet = async (mnemonic, networkIdentifier) => {
    const hdRootAccount = {
        mnemonic: mnemonic,
        rootAccountPublicKey: '',
        rootAccountAddress: '',
    };

    const paperWallet = new SymbolPaperWallet(
        hdRootAccount,
        [],
        networkIdentifierToNetworkType(networkIdentifier),
        // TODO: replace with real hash
        '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'
    );

    const bytes = await paperWallet.toPdf();
    const Uint8ToString = u8a => {
        const CHUNK_SZ = 0x8000;
        const c = [];
        for (let i = 0; i < u8a.length; i += CHUNK_SZ) {
            c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
        }
        return c.join('');
    };
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const btoa = (input = '') => {
        let str = input;
        let output = '';

        for (
            let block = 0, charCode, i = 0, map = chars;
            str.charAt(i | 0) || ((map = '='), i % 1);
            output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
        ) {
            charCode = str.charCodeAt((i += 3 / 4));

            if (charCode > 0xff) {
                throw new Error('"btoa" failed: The string to be encoded contains characters outside of the Latin1 range.');
            }

            block = (block << 8) | charCode;
        }

        return output;
    };

    const paperWalletDataToWrite = await btoa(Uint8ToString(bytes));
    const uniqueValue = new Date().getTime().toString().slice(9);
    await downloadFile(paperWalletDataToWrite, `symbol-wallet-${uniqueValue}.pdf`, 'base64')
}


export const downloadFile = async (file, filename, encoding) => {
    if (Platform.OS === 'ios') {
        return saveFile(file, filename, 'ios', encoding);
    } else {
        return downloadAndroid(file, filename, encoding);
    }
};

const downloadAndroid = async (file, filename, encoding) => {
    const isPermissionAlreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if (isPermissionAlreadyGranted) {
        return saveFile(file, filename, 'android', encoding);
    }

    const isPermissionGranted = await requestWritePermission();
    if (isPermissionGranted) {
        return saveFile(file, filename, 'android', encoding);
    } 
    // noerror
    throw Error('error_permission_denied_write_storage');
};

const requestWritePermission = async () => {
    try {
        const isPermissionGranted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, /*{
            title: translate('CreateWallet.ShowQRCode.permissionTitle'),
            message: translate('CreateWallet.ShowQRCode.permissionMessage'),
            buttonNegative: translate('CreateWallet.ShowQRCode.permissionTextCancel'),
            buttonPositive: translate('CreateWallet.ShowQRCode.permissionTextOk'),
        }*/);
        
        return isPermissionGranted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
        return false;
    }
};

const saveFile = async (data, filename, platform, encoding) => {
    const { dirs } = RNFetchBlob.fs;
    
    try {
        await RNFetchBlob.fs.writeFile(`${platform === 'ios' ? dirs.DocumentDir : dirs.DownloadDir}/${filename}`, data, encoding);

        if (platform === 'ios') {
            RNFetchBlob.ios.previewDocument(`${dirs.DocumentDir}/${filename}`);
        }
    }
    catch(error) {
        // noerror
        throw Error('error_failed_write_file: ' + error.message)
    }
            
    return true;
};
