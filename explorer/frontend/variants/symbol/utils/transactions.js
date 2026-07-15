/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A Symbol
 * aggregate bonded transaction stays in the partial group until the required cosignatures are
 * collected, then moves to the unconfirmed group.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction => transaction.group === 'partial';
