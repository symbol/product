import { transactionToPayload } from 'src/utils/transaction';
import { networkIdentifierToNetworkType } from 'src/utils/network';
import * as QRCodeCanvas from 'qrcode/lib/server';


const SYMBOL_QR_CODE_VERSION = 3;

export const SymbolQRCodeType = {
    Contact: 1,
    Account: 2,
    Transaction: 3,
    Mnemonic: 5,
    Address: 7,
};

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
        publicKey
    };

    return createBaseSymbolQR(SymbolQRCodeType.Contact, data, networkProperties);
}

export const createAccountSymbolQR = (privateKey, networkProperties) => {
    const data = {
        privateKey
    };

    return createBaseSymbolQR(SymbolQRCodeType.Account, data, networkProperties);
}

export const createTransactionSymbolQR = (transaction, networkProperties) => {
    const data = {
        payload: transactionToPayload(transaction, networkProperties)
    };

    return createBaseSymbolQR(SymbolQRCodeType.Transaction, data, networkProperties);
};

export const createMnemonicSymbolQR = (mnemonicString, networkProperties) => {
    const data = {
        mnemonic: mnemonicString
    };

    return createBaseSymbolQR(SymbolQRCodeType.Mnemonic, data, networkProperties);
};

export const createAddressSymbolQR = (name, address, networkProperties) => {
    const data = {
        name,
        address
    };

    return createBaseSymbolQR(SymbolQRCodeType.Address, data, networkProperties);
};

export const createSymbolQR = async (type, data, networkProperties) => {
    switch (type) {
        case SymbolQRCodeType.Contact:
            return createContactSymbolQR(data.name, data.publicKey, networkProperties);
        case SymbolQRCodeType.Account:
            return createAccountSymbolQR(data.privateKey, networkProperties);
        case SymbolQRCodeType.Transaction:
            return createTransactionSymbolQR(data.transaction, networkProperties);
        case SymbolQRCodeType.Mnemonic:
            return createMnemonicSymbolQR(data.mnemonic, networkProperties);
        case SymbolQRCodeType.Address:
            return createAddressSymbolQR(data.name, data.address, networkProperties);
        default:
            throw new Error('error_qr_unsupported');
    }
}

export const convertQRToBase64 = async (qrData) => {
    const settings = {
        errorCorrectionLevel: 'M',
    };

    return QRCodeCanvas.toDataURL(JSON.stringify(qrData), settings);
}