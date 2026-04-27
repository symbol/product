import { ActionType } from '@/app/lib/transport';
import { $t } from '@/app/localization';
import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/lib/transport').ShareAccountAddressUri} ShareAccountAddressUri */
/** @typedef {import('@/app/lib/transport').ShareTransferTransactionUri} ShareTransferTransactionUri */
/** @typedef {import('@/app/lib/transport').RequestSendTransactionUri} RequestSendTransactionUri */
/** @typedef {import('@/app/types/Table').TableRow} TableRow */

/**
 * @typedef {ShareAccountAddressUri | ShareTransferTransactionUri | RequestSendTransactionUri} TransportUriObject
 */

const getTransportPayloadParameters = transportUriObject => {
	// eslint-disable-next-line no-unused-vars
	const { parameters: { chainName, networkIdentifier, networkId, ...payloadParameters } } = transportUriObject.toJSON();
    
	return payloadParameters;
};

const hasParametersToCreateTokenInfo = parameters => {
	return Boolean(parameters.tokenId);
};

const createTokenInfo = parameters => {
	const tokenInfoBase = {
		id: parameters.tokenId
	};

	if (parameters.amount)
		tokenInfoBase.amount = parameters.amount;
	else
		tokenInfoBase.amount = null;

	return tokenInfoBase;
};

const attachTokenInfoToParameters = parameters => {
	if (hasParametersToCreateTokenInfo(parameters)) {
		// eslint-disable-next-line no-unused-vars
		const { tokenId, amount, ...restParameters } = parameters;
        
		return {
			...restParameters,
			token: createTokenInfo(parameters)
		};
	}

	return parameters;
};

/**
 * @typedef {Object} RequestDetailsViewModel
 * @property {boolean} isVisible - Indicates whether the request details should be displayed
 * @property {string | undefined} title - Display title derived from the action type ('request' or 'share')
 * @property {TableRow[]} tableData - Table rows built from the remaining URI parameters
 */

/**
 * Creates a view model for displaying transport URI request details.
 *
 * @param {TransportUriObject | null} transportUriObject - Parsed transport URI action instance
 * @returns {RequestDetailsViewModel} View model with title and table data for the RequestDetails component
 */
export const createRequestDetailsViewModel = transportUriObject => {
	if (!transportUriObject)
		return { isVisible: false, title: null, tableData: [] };

	const { actionType } = transportUriObject.constructor;

	if (actionType === ActionType.REQUEST) {
		// Text
		const title = $t('s_transportRequest_details_request_title');
		
		return {
			isVisible: true,
			title,
			description: '',
			tableData: []
		};
	} else if (actionType === ActionType.SHARE) {
		// Text
		const title = $t('s_transportRequest_details_share_title');
		const description = $t('s_transportRequest_details_share_description');

		// Details table data
		const payloadParameters = getTransportPayloadParameters(transportUriObject);
		const parametersWithTokenInfo = attachTokenInfoToParameters(payloadParameters);
		const tableData = objectToTableData(parametersWithTokenInfo);

		return {
			isVisible: true,
			title,
			description,
			tableData
		};
	}
};
