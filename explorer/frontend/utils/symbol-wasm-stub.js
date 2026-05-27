// Stub for symbol-crypto-wasm-node in browser builds.
// These functions should not be invoked by the explorer runtime shell.
export const HashMode = {};
export const crypto_sign_keypair = () => { throw new Error('symbol-crypto-wasm not initialized'); };
export const crypto_private_sign = () => { throw new Error('symbol-crypto-wasm not initialized'); };
export const crypto_private_verify = () => { throw new Error('symbol-crypto-wasm not initialized'); };
