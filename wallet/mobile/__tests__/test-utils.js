import { networkIdentifiers } from '__fixtures__/local/wallet';

export const writeFileJSON = (fileName, data) => {
    const fs = require('fs');
    fs.writeFileSync(`__fixtures__/${fileName}.json`, JSON.stringify(data, null, 4));
};

export const createNetworkMap = (networkIdentifiers, callback) => {
    const maps = networkIdentifiers.map((networkIdentifier) => [networkIdentifier, callback(networkIdentifier)]);

    return Object.fromEntries(maps);
};

/**
 * Run a test function by iterating over all network related accounts.
 * @template ItemType
 * @param {{ [key: string]: ItemType[] }} networkMap - The network map.
 * @param {function(string, ItemType, number)} testFunction - The test function.
 */
export const forEachNetwork = (networkMap, testFunction) => {
    createNetworkMap(networkIdentifiers, (networkIdentifier) => {
        networkMap[networkIdentifier].map((item, index) => {
            testFunction(networkIdentifier, item, index);
        });
    });
};

/**
 * Generates all possible bitwise OR combinations of a base value with a set of bits.
 * @param {number} baseValue - The base value (e.g., 1).
 * @param {number[]} bits - Array of bit values (e.g., [2, 4, 8]).
 * @returns {number[]} Array of unique bitwise OR combinations.
 */
export const generateBitCombinations = (baseValue, bits) => {
    const results = new Set();
    const bitCount = bits.length;

    // Generate all subsets of bits and OR them with the base value
    for (let i = 0; i < 1 << bitCount; i++) {
        let combinedValue = baseValue;

        for (let j = 0; j < bitCount; j++) {
            if (i & (1 << j)) {
                combinedValue |= bits[j];
            }
        }

        results.add(combinedValue);
    }

    return Array.from(results);
};
