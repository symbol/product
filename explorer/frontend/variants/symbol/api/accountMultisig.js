import { fetchSymbolNode, hexToSymbolAddress } from '../utils';

const normalizeAddress = address => address ? hexToSymbolAddress(address) : null;

const accountMultisigFromDTO = data => {
	const multisig = data.multisig || {};
	const cosignatoryAddresses = (multisig.cosignatoryAddresses || []).map(normalizeAddress).filter(address => !!address);
	const multisigAddresses = (multisig.multisigAddresses || []).map(normalizeAddress).filter(address => !!address);
	const isMultisigAccount = cosignatoryAddresses.length > 0;

	return {
		minApproval: isMultisigAccount ? Number(multisig.minApproval || 0) : null,
		minRemoval: isMultisigAccount ? Number(multisig.minRemoval || 0) : null,
		cosignatoryAddresses,
		multisigAddresses
	};
};

export const fetchAccountMultisig = async address => {
	const response = await fetchSymbolNode(`account/${hexToSymbolAddress(address)}/multisig`);

	return accountMultisigFromDTO(response);
};
