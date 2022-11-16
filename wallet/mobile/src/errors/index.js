// export class NodeIsDownError extends Error {
//     constructor(message) {
//         super(message);
//         this.name = "ValidationError";
//     }
// }

export class FailedToSaveMnemonicError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FailedToSaveMnemonicError';
    }
}

export const createError = name => {
    return class extends Error {
        constructor(message) {
            super(message);
            this.name = name;
        }
    }
}

export default {
    NodeIsDownError: 'NodeIsDownError'
};
