/**
 * Creates the `@/app/utils` account display-data overrides backed by a fixed address-to-info map.
 * Spread the result into a `jest.mock('@/app/utils', ...)` factory alongside `jest.requireActual`,
 * so name resolution becomes deterministic while every other util stays real.
 * @param {{[address: string]: { name: string|null, imageId: string|null }}} accountInfoMap - The known info per address.
 * @returns {object} The `getAccountKnownInfo` and `createAccountDisplayData` overrides.
 */
export const createAccountDisplayDataUtilsMock = accountInfoMap => {
	const getAccountKnownInfo = address => accountInfoMap[address] ?? { name: null, imageId: null };

	return {
		getAccountKnownInfo,
		createAccountDisplayData: address => {
			const knownInfo = getAccountKnownInfo(address);

			return { address, name: knownInfo.name, imageId: knownInfo.imageId, color: '#000000' };
		}
	};
};
