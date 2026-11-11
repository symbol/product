/**
 * Gets the description text for a receipt showing block height.
 * @param {object} receipt - Receipt object.
 * @param {number} receipt.height - Block height of the receipt.
 * @returns {string} Description text.
 */
export const getReceiptDescription = receipt => {
	const { height } = receipt;
	
	return `Block #${height}`;
};
