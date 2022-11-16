// export class NodeIsDownError extends Error {
//     constructor(message) {
//         super(message);
//         this.name = "ValidationError";
//     }
// }

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
