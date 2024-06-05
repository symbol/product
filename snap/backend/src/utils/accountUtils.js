import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const accountUtils = {
	/**
	 * * Derives a key pair from a mnemonic and an address index.
	 * @param {'mainnet' | 'testnet'} networkName - The network name.
	 * @param {number} addressIndex - The address index.
	 * @returns {Promise<SymbolFacade.KeyPair>} - The derived key pair.
	 */
	async deriveKeyPair(networkName, addressIndex) {
		const facade = new SymbolFacade(networkName);
		const coinType = facade.bip32Path(addressIndex)[1];

		const rootNode = await snap.request({
			method: 'snap_getBip44Entropy',
			params: {
				coinType
			}
		});

		const derivePrivateKey = await getBIP44AddressKeyDeriver(rootNode);
		const key = await derivePrivateKey(addressIndex);

		const privateKey = new PrivateKey(key.privateKeyBytes);
		return new SymbolFacade.KeyPair(privateKey);
	}
};

export default accountUtils;
