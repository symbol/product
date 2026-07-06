import { useCallback, useMemo, useState } from 'react';
import { generateNonce, mosaicIdFromNonce } from 'wallet-common-symbol';

/**
 * Return type for useMosaicIdentity hook.
 * @typedef {object} UseMosaicIdentityReturnType
 * @property {number} nonce - The mosaic nonce. Stable for the lifetime of the create flow until regenerated.
 * @property {string | null} mosaicId - The mosaic id derived from the creator address and nonce, or null when the
 *   creator address is not yet known.
 * @property {() => void} regenerate - Generates a new nonce, yielding a new mosaic identity.
 */

/**
 * React hook that owns the identity of the mosaic being created. The nonce is generated once so that the derived
 * mosaic id stays stable across fee recalculation, signing and announcing, and can be shown on the screen. The mosaic
 * id depends on the creator address, so it is re-derived whenever the sender changes. Call regenerate after a create
 * flow completes to avoid reusing a nonce (which would collide with the just-created mosaic).
 * @param {string} [senderAddress] - The mosaic creator address. When absent, the mosaic id is null.
 * @returns {UseMosaicIdentityReturnType}
 */
export const useMosaicIdentity = senderAddress => {
	const [nonce, setNonce] = useState(generateNonce);

	const mosaicId = useMemo(
		() => (senderAddress ? mosaicIdFromNonce(senderAddress, nonce) : null),
		[senderAddress, nonce]
	);

	const regenerate = useCallback(() => setNonce(generateNonce()), []);

	return {
		nonce,
		mosaicId,
		regenerate
	};
};
