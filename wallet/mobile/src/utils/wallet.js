// import Clipboard from '@react-native-community/clipboard';
import { PermissionsAndroid, Platform } from 'react-native'; // Remove after fix https://github.com/react-native-clipboard/clipboard/issues/71
import { SymbolPaperWallet } from 'symbol-wallets-lib';
import RNFetchBlob from 'rn-fetch-blob';
import { Buffer } from 'buffer';
import { networkIdentifierToNetworkType } from './network';
import { optInWhiteList } from 'src/config';
import { createWalletStorageAccount, publicAccountFromPrivateKey } from './account';
import { Bip32 } from 'symbol-sdk-v3';
import { SymbolFacade } from 'symbol-sdk-v3/symbol';
import { DEFAULT_ACCOUNT_NAME, MAX_SEED_ACCOUNTS_PER_NETWORK, NetworkIdentifier, WalletAccountType } from 'src/constants';
import { createNetworkMap } from 'src/utils/helper';

export const generateMnemonic = () => {
    const bip = new Bip32();
    const mnemonic = bip.random();

    return mnemonic.toString();
};

export const createPrivateKeysFromMnemonic = (mnemonic, indexes, networkIdentifier, isOptInCurve) => {
    const facade = new SymbolFacade(networkIdentifier);
    const symbolCurve = facade.static.BIP32_CURVE_NAME;
    const optInCurve = 'secp256k1';
    const curve = isOptInCurve ? optInCurve : symbolCurve;
    const bip = new Bip32(curve);
    const rootNode = bip.fromMnemonic(mnemonic, '');

    const privateKeys = indexes.map((index) => {
        const path = facade.bip32Path(index);
        const childNode = rootNode.derivePath(path);
        const childKeyPair = facade.constructor.bip32NodeToKeyPair(childNode);

        return childKeyPair.privateKey.toString();
    });

    return privateKeys;
}

export const downloadPaperWallet = async (mnemonic, rootAccount, networkIdentifier) => {
    const hdRootAccount = {
        mnemonic: mnemonic,
        rootAccountPublicKey: rootAccount.publicKey,
        rootAccountAddress: rootAccount.address,
    };

    const paperWallet = new SymbolPaperWallet(hdRootAccount, [], networkIdentifierToNetworkType(networkIdentifier));

    const paperWalletPdf = await paperWallet.toPdf();
    const paperWalletBase64 = Buffer.from(paperWalletPdf).toString('base64');
    const uniqueValue = new Date().getTime().toString().slice(9);
    const filename = `symbol-wallet-${uniqueValue}.pdf`;
    await writeFile(paperWalletBase64, filename, 'base64');
};

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
    } catch (e) {
        throw Error('error_failed_write_file');
    }

    return true;
};

export const createOptInPrivateKeyFromMnemonic = (mnemonic) => {
    const [optInPrivateKey] = createPrivateKeysFromMnemonic(mnemonic.trim(), [0], NetworkIdentifier.MAIN_NET, 'optin');
    const optInAccount = publicAccountFromPrivateKey(optInPrivateKey, NetworkIdentifier.MAIN_NET);
    const isKeyWhitelisted = optInWhiteList.some((publicKey) => publicKey === optInAccount.publicKey);

    return isKeyWhitelisted ? optInPrivateKey : null;
};

export const generateSeedAccounts = async (mnemonic) => {
    const seedIndexes = [...Array(MAX_SEED_ACCOUNTS_PER_NETWORK).keys()];

    return createNetworkMap((networkIdentifier) =>
        createPrivateKeysFromMnemonic(mnemonic, seedIndexes, networkIdentifier)
            .map((privateKey, index) => createWalletStorageAccount(
                privateKey,
                networkIdentifier,
                `${DEFAULT_ACCOUNT_NAME} ${index + 1}`,
                WalletAccountType.SEED,
                index
            ))
    );
}
