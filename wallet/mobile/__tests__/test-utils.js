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
