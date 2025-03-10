import { networkIdentifierToNetworkType, networkTypeToIdentifier } from '@/app/utils/network';
import * as QRCodeCanvas from 'qrcode/lib/server';

export class SymbolQR {
    static VERSION = 3;

    static TYPE = {
        Contact: 1,
        Account: 2,
        Transaction: 3,
        Mnemonic: 5,
        Address: 7,
    };

    static SCHEMAS = {
        [SymbolQR.TYPE.Contact]: {
            required: ['name', 'publicKey'],
            optional: [],
        },
        [SymbolQR.TYPE.Account]: {
            required: ['privateKey'],
            optional: [],
        },
        [SymbolQR.TYPE.Transaction]: {
            required: ['payload'],
            optional: [],
        },
        [SymbolQR.TYPE.Mnemonic]: {
            required: ['plainMnemonic'],
            optional: [],
        },
        [SymbolQR.TYPE.Address]: {
            required: ['name', 'address'],
            optional: [],
        },
    };

    constructor(type, data, networkProperties) {
        if (!Object.values(SymbolQR.TYPE).includes(type)) {
            throw new Error(`Unsupported Symbol QR type: "${type}"`);
        }

        this.version = SymbolQR.VERSION;
        this.type = type;
        this.networkIdentifier = networkProperties.networkIdentifier;
        this.generationHash = networkProperties.generationHash;
        this.data = data;

        this.validateData();
    }

    /**
     * Validates QR data based on the schema for the given type.
     */
    validateData() {
        const schema = SymbolQR.SCHEMAS[this.type];
        const dataKeys = Object.keys(this.data);

        // Check required parameters
        schema.required.forEach((key) => {
            if (!dataKeys.includes(key)) {
                throw new Error(`Missing required parameter "${key}" for QR type "${this.type}"`);
            }
        });

        // Check for unknown parameters
        const allAllowedKeys = [...schema.required, ...schema.optional];
        dataKeys.forEach((key) => {
            if (!allAllowedKeys.includes(key)) {
                throw new Error(`Unknown parameter "${key}" for QR type "${this.type}"`);
            }
        });
    }

    /**
     * Converts the SymbolQR object into a JSON string for QR code generation.
     * @returns {string} The QR JSON data.
     */
    toTransportString() {
        return JSON.stringify({
            v: this.version,
            type: this.type,
            network_id: networkIdentifierToNetworkType(this.networkIdentifier),
            chain_id: this.generationHash,
            data: this.data,
        });
    }

    /**
     * Converts the SymbolQR object into a JSON object.
     * @returns {Object} The JSON object.
     */
    toJSON() {
        return {
            version: this.version,
            type: this.type,
            networkIdentifier: this.networkIdentifier,
            generationHash: this.generationHash,
            data: this.data,
        };
    }

    /**
     * Generates a QR code as a base64-encoded image.
     * @returns {Promise<string>} Base64-encoded QR image.
     */
    async toBase64() {
        const settings = { errorCorrectionLevel: 'M' };
        return await QRCodeCanvas.toDataURL(this.toTransportString(), settings);
    }

    /**
     * Parses a given JSON string into a SymbolQR object.
     * @param {string} json - The QR JSON string.
     * @returns {SymbolQR} An instance of SymbolQR with validated data.
     */
    static fromTransportString(json) {
        const qrData = JSON.parse(json);
        const networkProperties = {
            networkIdentifier: networkTypeToIdentifier(qrData.network_id),
            generationHash: qrData.chain_id,
        };
        return new SymbolQR(qrData.type, qrData.data, networkProperties);
    }
}
