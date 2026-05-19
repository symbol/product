// Stub for symbol-crypto-wasm-node in browser/Turbopack builds.
// These exports are only consumed by KeyPair and Verifier in symbol-sdk,
// which are not used in this application. The stubs are never invoked.
export const HashMode = {};
export const crypto_sign_keypair = () => { throw new Error('symbol-crypto-wasm not initialized'); };
export const crypto_private_sign = () => { throw new Error('symbol-crypto-wasm not initialized'); };
export const crypto_private_verify = () => { throw new Error('symbol-crypto-wasm not initialized'); };
