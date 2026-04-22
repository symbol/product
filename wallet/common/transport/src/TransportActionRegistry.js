import { RequestSendTransactionUri, ShareAccountAddressUri, ShareTransferTransactionUri } from './actions';
import { ActionType } from './protocol/constants';
import { UnsupportedActionError } from './errors';

// New actions register here:
const registeredActions = [
	ShareAccountAddressUri,
	ShareTransferTransactionUri,
	RequestSendTransactionUri
];


// Build action registries for quick lookup
const shareActionRegistry = {};
const requestActionRegistry = {};

registeredActions.forEach(ActionClass => {
	const isShareAction = ActionClass.actionType === ActionType.SHARE;
	const isRequestAction = ActionClass.actionType === ActionType.REQUEST;
    
	if (isShareAction)
		shareActionRegistry[ActionClass.method] = ActionClass;
	else if (isRequestAction)
		requestActionRegistry[ActionClass.method] = ActionClass;
	else
		throw new Error(`Invalid action configuration: unknown action type "${ActionClass.actionType}"`);
});

// Verify all actions were registered successfully
const totalRegisteredCount = Object.keys(shareActionRegistry).length + Object.keys(requestActionRegistry).length;
const hasRegistrationMismatch = totalRegisteredCount !== registeredActions.length;

if (hasRegistrationMismatch)
	throw new Error('Action registry mismatch: some actions were not registered correctly');


// API

/**
 * Gets the action class for a given action type and method.
 * 
 * @param {string} actionType - The action type ('share' or 'request')
 * @param {string} method - The method name (e.g., 'accountAddress')
 * @returns {Function|undefined} The action class constructor, or undefined if not found
 * @throws {UnsupportedActionError} If the action type is not recognized
 */
export const getActionClass = (actionType, method) => {
	const isShareAction = actionType === ActionType.SHARE;
	const isRequestAction = actionType === ActionType.REQUEST;
    
	if (isShareAction)
		return shareActionRegistry[method];

	if (isRequestAction)
		return requestActionRegistry[method];

	throw new UnsupportedActionError(actionType);
};

/**
 * Checks if an action type/method combination is supported.
 * 
 * @param {string} actionType - The action type
 * @param {string} method - The method name
 * @returns {boolean} True if the action is supported
 */
export const isActionSupported = (actionType, method) => {
	try {
		const ActionClass = getActionClass(actionType, method);
		return !!ActionClass;
	} catch {
		return false;
	}
};

/**
 * Gets a list of supported 'request' action method names.
 * 
 * @returns {string[]} Array of supported method names
 */
export const getSupportedRequestMethods = () => {
	return Object.keys(requestActionRegistry);
};

/**
 * Gets a list of supported 'share' action method names.
 * 
 * @returns {string[]} Array of supported method names
 */
export const getSupportedShareMethods = () => {
	return Object.keys(shareActionRegistry);
};
