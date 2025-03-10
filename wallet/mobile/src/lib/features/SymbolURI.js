const URI_SCHEME = 'web+symbol';

const SCHEMAS = {
    transaction: {
        required: ['data', 'generationHash'],
        optional: [],
    },
};

export class SymbolURI {
    constructor(action, params = {}) {
        if (!SCHEMAS[action]) {
            throw new Error(`Unsupported Symbol URI action: "${action}"`);
        }

        this.scheme = URI_SCHEME;
        this.action = action;
        this.params = params;

        this.validateParams();
    }

    /**
     * Validates parameters based on the schema for the given action.
     */
    validateParams() {
        const schema = SCHEMAS[this.action];
        const paramKeys = Object.keys(this.params);

        // Check required parameters
        schema.required.forEach((key) => {
            if (!paramKeys.includes(key)) {
                throw new Error(`Missing required parameter "${key}" for action "${this.action}"`);
            }
        });

        // Check for unknown parameters
        const allAllowedKeys = [...schema.required, ...schema.optional];
        paramKeys.forEach((key) => {
            if (!allAllowedKeys.includes(key)) {
                throw new Error(`Unknown parameter "${key}" for action "${this.action}"`);
            }
        });
    }

    /**
     * Converts the SymbolURI object into a URI string.
     * @returns {string} The constructed URI.
     */
    toURI() {
        const queryString = new URLSearchParams(this.params).toString();
        return `${this.scheme}://${this.action}?${queryString}`;
    }

    /**
     * Converts the SymbolURI object into a JSON object.
     * @returns {Object} The JSON object.
     */
    toJSON() {
        return {
            scheme: this.scheme,
            action: this.action,
            params: this.params,
        };
    }

    /**
     * Parses a given URI string into a SymbolURI object.
     * @param {string} uri - The Symbol URI string.
     * @returns {SymbolURI} An instance of SymbolURI with validated data.
     */
    static fromURI(uri) {
        try {
            const url = new URL(uri);
            const action = url.hostname;
            const params = Object.fromEntries(new URLSearchParams(url.search));

            return new SymbolURI(action, params);
        } catch (error) {
            throw new Error(`Invalid Symbol URI: ${uri}`);
        }
    }
}
