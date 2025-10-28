/**
 * Creates a network map. The network map is an object with network identifiers as keys and values returned by the callback function.
 * @template CallbackReturnType
 * @param {function(string): CallbackReturnType} callback - The callback function that receives a network identifier as an argument.
 * @param {string[]} networkIdentifiers - An array of network identifiers to create the map for.
 * @returns {Record<string, CallbackReturnType>} The network map.
 */
export const createNetworkMap = (callback, networkIdentifiers) => {
	const maps = networkIdentifiers.map(networkIdentifier => [networkIdentifier, callback(networkIdentifier)]);

	return Object.fromEntries(maps);
};

/**
 * Clones a network array map. The cloned map contains arrays for each network identifier, copying the contents of the original map.
 * @template ArrayItemType
 * @param {Record<string, Array<ArrayItemType>>} map - The original network array map to clone.
 * @param {string[]} networkIdentifiers - An array of network identifiers to create the cloned map for.
 * @param {Record<string, Array<ArrayItemType>>} defaultValue - The default value to return if the map is not provided.
 * @returns {Record<string, Array<ArrayItemType>>} The cloned network array map.
 */
export const cloneNetworkArrayMap = (map, networkIdentifiers, defaultValue) => {
	if (!map) 
		return defaultValue;

	return createNetworkMap(
		networkIdentifier => map[networkIdentifier] ? [...map[networkIdentifier]] : [],
		networkIdentifiers
	);
};

/**
 * Clones a network object map. The cloned map contains objects for each network identifier, copying the contents of the original map.
 * @param {Record<string, object>} map - The original network object map to clone.
 * @param {string[]} networkIdentifiers - An array of network identifiers to create the cloned map for.
 * @param {Record<string, object>} defaultValue - The default value to return if the map is not provided.
 * @returns {Record<string, object>} The cloned network object map.
 */
export const cloneNetworkObjectMap = (map, networkIdentifiers, defaultValue) => {
	if (!map) 
		return defaultValue;

	return createNetworkMap(
		networkIdentifier => map[networkIdentifier] ? { ...map[networkIdentifier] } : {},
		networkIdentifiers
	);
};
