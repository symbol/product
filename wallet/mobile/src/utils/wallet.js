import { SymbolPaperWallet } from 'symbol-wallets-lib';
import { Buffer } from 'buffer';
import { networkIdentifierToNetworkType } from './network';
import { optInWhiteList } from '@/app/config';
import { createWalletStorageAccount, publicAccountFromPrivateKey } from './account';
import { Bip32 } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';
import { DEFAULT_ACCOUNT_NAME, MAX_SEED_ACCOUNTS_PER_NETWORK, NetworkIdentifier, WalletAccountType } from '@/app/constants';
import { createNetworkMap } from '@/app/utils/network';

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
};

export const createPaperWallet = async (mnemonic, rootAccount, networkIdentifier) => {
    const hdRootAccount = {
        mnemonic: mnemonic,
        rootAccountPublicKey: rootAccount.publicKey,
        rootAccountAddress: rootAccount.address,
    };

    const paperWallet = new SymbolPaperWallet(hdRootAccount, [], networkIdentifierToNetworkType(networkIdentifier));

    const paperWalletPdf = await paperWallet.toPdf();
    const paperWalletBase64 = Buffer.from(paperWalletPdf).toString('base64');

    return paperWalletBase64;
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
        createPrivateKeysFromMnemonic(mnemonic, seedIndexes, networkIdentifier).map((privateKey, index) =>
            createWalletStorageAccount(privateKey, networkIdentifier, `${DEFAULT_ACCOUNT_NAME} ${index + 1}`, WalletAccountType.SEED, index)
        )
    );
};
