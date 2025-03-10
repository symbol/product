import { addressFromPublicKey, publicAccountFromPrivateKey } from '@/app/utils/account';

export const extractContactSymbolQR = (qrData) => {
    const { generationHash, networkIdentifier, data, type } = qrData;
    const { publicKey } = data;

    return {
        type,
        generationHash,
        networkIdentifier,
        name: data.name,
        publicKey,
        address: addressFromPublicKey(publicKey, networkIdentifier),
    };
};

export const extractAccountSymbolQR = (qrData) => {
    const { generationHash, networkIdentifier, data, type } = qrData;
    const { privateKey } = data;
    const publicAccount = publicAccountFromPrivateKey(privateKey, networkIdentifier);

    return {
        type,
        generationHash,
        networkIdentifier,
        privateKey,
        publicKey: publicAccount.publicKey,
        address: publicAccount.address,
    };
};

export const extractTransactionSymbolQR = (qrData) => {
    const { generationHash, networkIdentifier, data, type } = qrData;

    return {
        type,
        generationHash,
        networkIdentifier,
        data: data.payload,
    };
};

export const extractMnemonicSymbolQR = (qrData) => {
    const { generationHash, networkIdentifier, data, type } = qrData;

    return {
        type,
        generationHash,
        networkIdentifier,
        mnemonic: data.plainMnemonic,
    };
};

export const extractAddressSymbolQR = (qrData) => {
    const { generationHash, networkIdentifier, data, type } = qrData;

    return {
        type,
        generationHash,
        networkIdentifier,
        name: data.name,
        address: data.address,
    };
};
