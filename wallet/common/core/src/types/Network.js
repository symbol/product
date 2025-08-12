/**
 * @template T
 * @typedef {Record.<string, T>} NetworkMap
 * A generic map where the key is a network identifier (e.g., 'mainnet', 'testnet', or any custom network),
 * and the value is of generic type T.
 */

/**
 * @template V
 * @typedef {Record.<string, V[]>} NetworkArrayMap
 * A map where the key is a network identifier and the value is an array of items of type V.
 */

/**
 * @template V
 * @typedef {Record.<string, Record.<string, V>>} NetworkObjectMap
 * A map where the key is a network identifier and the value is another object/map with keys of type K and values of type V.
 */

/**
 * @typedef {Object} NetworkProperties
 * @property {string} nodeUrl - API node URL.
 * @property {string} networkIdentifier - Network identifier.
 * @property {number} chainHeight - Chain height at the time of the request.
 */

export default {};
