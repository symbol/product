import { networkIdentifierToNetworkType, networkTypeToIdentifier } from '@/app/utils/network';
import * as QRCodeCanvas from 'qrcode/lib/server';
import { addressFromPublicKey, publicAccountFromPrivateKey } from '@/app/utils/account';
import { AppError } from '@/app/lib/error';

const SYMBOL_QR_CODE_VERSION = 3;

export const SymbolQRCodeType = {
    Contact: 1,
    Account: 2,
    Transaction: 3,
    Mnemonic: 5,
    Address: 7,
};

// Create QR Codes

const createBaseSymbolQR = (type, data, networkProperties) => ({
    v: SYMBOL_QR_CODE_VERSION,
    type,
    network_id: networkIdentifierToNetworkType(networkProperties.networkIdentifier),
    chain_id: networkProperties.generationHash,
    data,
});

export const createContactSymbolQR = (name, publicKey, networkProperties) => {
    const data = {
        name,
        publicKey,
    };

    return createBaseSymbolQR(SymbolQRCodeType.Contact, data, networkProperties);
};

export const createAccountSymbolQR = (privateKey, networkProperties) => {
    const data = {
        privateKey,
    };

    return createBaseSymbolQR(SymbolQRCodeType.Account, data, networkProperties);
};

export const createTransactionSymbolQR = (transactionPayload, networkProperties) => {
    const data = {
        payload: transactionPayload,
    };

    return createBaseSymbolQR(SymbolQRCodeType.Transaction, data, networkProperties);
};

export const createMnemonicSymbolQR = (mnemonicPlainText, networkProperties) => {
    const data = {
        mnemonic: mnemonicPlainText,
    };

    return createBaseSymbolQR(SymbolQRCodeType.Mnemonic, data, networkProperties);
};

export const createAddressSymbolQR = (name, address, networkProperties) => {
    const data = {
        name,
        address,
    };

    return createBaseSymbolQR(SymbolQRCodeType.Address, data, networkProperties);
};

export const createSymbolQR = (type, data, networkProperties) => {
    switch (type) {
        case SymbolQRCodeType.Contact:
            return createContactSymbolQR(data.name, data.publicKey, networkProperties);
        case SymbolQRCodeType.Account:
            return createAccountSymbolQR(data.privateKey, networkProperties);
        case SymbolQRCodeType.Transaction:
            return createTransactionSymbolQR(data.transactionPayload, networkProperties);
        case SymbolQRCodeType.Mnemonic:
            return createMnemonicSymbolQR(data.mnemonicPlainText, networkProperties);
        case SymbolQRCodeType.Address:
            return createAddressSymbolQR(data.name, data.address, networkProperties);
        default:
            throw new AppError('error_qr_unsupported', `Failed to create QR code. Type "${type}" is not supported`);
    }
};

export const convertQRToBase64 = (qrData) => {
    const settings = {
        errorCorrectionLevel: 'M',
    };

    return QRCodeCanvas.toDataURL(JSON.stringify(qrData), settings);
};

// Parse QR Codes

const parseBaseSymbolQR = (qrData) => {
    const isValidVersion = qrData.v === SYMBOL_QR_CODE_VERSION;

    if (!isValidVersion) throw new AppError('error_qr_unsupported', `Failed to parse QR code. Version "${qrData.v}" is not supported`);

    return {
        type: qrData.type,
        networkIdentifier: networkTypeToIdentifier(qrData.network_id),
        generationHash: qrData.chain_id,
        payload: qrData.data,
    };
};

export const parseContactSymbolQR = (qrData) => {
    const parsedData = parseBaseSymbolQR(qrData);
    const { generationHash, networkIdentifier, payload, type } = parsedData;
    const { name, publicKey } = payload;

    return {
        type,
        generationHash,
        networkIdentifier,
        name,
        publicKey,
        address: addressFromPublicKey(publicKey, networkIdentifier),
    };
};

export const parseAccountSymbolQR = (qrData) => {
    const parsedData = parseBaseSymbolQR(qrData);
    const { generationHash, networkIdentifier, payload, type } = parsedData;
    const { privateKey } = payload;
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

export const parseTransactionSymbolQR = (qrData) => {
    const parsedData = parseBaseSymbolQR(qrData);
    const { generationHash, networkIdentifier, payload, type } = parsedData;
    const { payload: transactionPayload } = payload;

    return {
        type,
        generationHash,
        networkIdentifier,
        transactionPayload,
    };
};

export const parseMnemonicSymbolQR = (qrData) => {
    const parsedData = parseBaseSymbolQR(qrData);
    const { generationHash, networkIdentifier, payload, type } = parsedData;
    const { mnemonic: mnemonicPlainText } = payload;

    return {
        type,
        generationHash,
        networkIdentifier,
        mnemonicPlainText,
    };
};

export const parseAddressSymbolQR = (qrData) => {
    const parsedData = parseBaseSymbolQR(qrData);
    const { generationHash, networkIdentifier, payload, type } = parsedData;
    const { name, address } = payload;

    return {
        type,
        generationHash,
        networkIdentifier,
        name,
        address,
    };
};

export const parseSymbolQR = (qrData) => {
    const { type } = qrData;

    switch (type) {
        case SymbolQRCodeType.Contact:
            return parseContactSymbolQR(qrData);
        case SymbolQRCodeType.Account:
            return parseAccountSymbolQR(qrData);
        case SymbolQRCodeType.Transaction:
            return parseTransactionSymbolQR(qrData);
        case SymbolQRCodeType.Mnemonic:
            return parseMnemonicSymbolQR(qrData);
        case SymbolQRCodeType.Address:
            return parseAddressSymbolQR(qrData);
        default:
            throw new AppError('error_qr_unsupported', `Failed to parse QR code. Type "${type}" is not supported`);
    }
};
