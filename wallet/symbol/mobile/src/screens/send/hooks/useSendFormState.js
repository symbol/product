import { useProp, useToggle } from '@/app/hooks';
import { useCallback, useEffect, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/screens/send/types/Send').SendRouteParams} SendRouteParams */

/** @type {TransactionFeeTierLevel} */
const DEFAULT_TRANSACTION_SPEED = 'medium';

const DEFAULT_AMOUNT = '0';

/**
 * Return type for useSendFormState hook.
 * @typedef {Object} UseSendFormStateReturnType
 * @property {string} senderAddress - The selected sender address.
 * @property {string} recipientAddress - The recipient address.
 * @property {string|null} selectedTokenId - The selected token identifier.
 * @property {string} amount - The transfer amount.
 * @property {string} messageText - The message text.
 * @property {boolean} isMessageEncrypted - Whether the message should be encrypted.
 * @property {TransactionFeeTierLevel} transactionSpeed - The selected transaction speed.
 * @property {boolean} isAmountValid - Whether the amount is valid.
 * @property {boolean} isRecipientValid - Whether the recipient is valid.
 * @property {(address: string) => void} changeSenderAddress - Updates the sender address.
 * @property {(address: string) => void} changeRecipientAddress - Updates the recipient address.
 * @property {(tokenId: string|null) => void} changeSelectedTokenId - Updates the selected token ID.
 * @property {(amount: string) => void} changeAmount - Updates the transfer amount.
 * @property {(text: string) => void} changeMessageText - Updates the message text.
 * @property {() => void} toggleMessageEncrypted - Toggles message encryption.
 * @property {(speed: TransactionFeeTierLevel) => void} changeTransactionSpeed - Updates transaction speed.
 * @property {(isValid: boolean) => void} changeAmountValidity - Updates amount validity state.
 * @property {(isValid: boolean) => void} changeRecipientValidity - Updates recipient validity state.
 * @property {() => void} reset - Resets all form state to defaults.
 */

/**
 * React hook for managing send form state.
 * Handles all form fields including sender, recipient, token, amount, message, and transaction speed.
 *
 * @param {Object} params - Hook parameters.
 * @param {string} params.defaultSenderAddress - The default sender address (current account).
 * @param {SendRouteParams} [params.routeParams] - Route parameters for pre-filled values.
 * @returns {UseSendFormStateReturnType}
 */
export const useSendFormState = ({ defaultSenderAddress, routeParams = {} }) => {
	const initialSenderAddress = routeParams.senderAddress || defaultSenderAddress;

	// Form inputs
	const [senderAddress, setSenderAddress] = useProp(initialSenderAddress);
	const [recipientAddress, setRecipientAddress] = useProp(routeParams.recipientAddress, '');
	const [selectedTokenId, setSelectedTokenId] = useProp(routeParams.tokenId, null);
	const [amount, setAmount] = useProp(routeParams.amount, DEFAULT_AMOUNT);
	const [messageText, setMessageText] = useProp(routeParams.message?.text, '');
	const [isMessageEncryptedValue, toggleMessageEncrypted] = useToggle(false);
	const [transactionSpeed, setTransactionSpeed] = useState(DEFAULT_TRANSACTION_SPEED);

	// Validation states
	const [isAmountValid, setAmountValid] = useState(false);
	const [isRecipientValid, setRecipientValid] = useState(false);

	const reset = useCallback(() => {
		setSenderAddress(initialSenderAddress);
		setRecipientAddress('');
		setSelectedTokenId(null);
		setAmount(DEFAULT_AMOUNT);
		setMessageText('');
		setTransactionSpeed(DEFAULT_TRANSACTION_SPEED);
		setAmountValid(false);
		setRecipientValid(false);
	}, [initialSenderAddress, setSenderAddress, setRecipientAddress, setSelectedTokenId, setAmount, setMessageText]);

	// Sync sender address when default changes
	useEffect(() => {
		setSenderAddress(initialSenderAddress);
	}, [initialSenderAddress, setSenderAddress]);

	return {
		// State values
		senderAddress,
		recipientAddress,
		selectedTokenId,
		amount,
		messageText,
		isMessageEncrypted: isMessageEncryptedValue,
		transactionSpeed,
		isAmountValid,
		isRecipientValid,

		// State setters
		changeSenderAddress: setSenderAddress,
		changeRecipientAddress: setRecipientAddress,
		changeSelectedTokenId: setSelectedTokenId,
		changeAmount: setAmount,
		changeMessageText: setMessageText,
		toggleMessageEncrypted,
		changeTransactionSpeed: setTransactionSpeed,
		changeAmountValidity: setAmountValid,
		changeRecipientValidity: setRecipientValid,
		reset
	};
};
