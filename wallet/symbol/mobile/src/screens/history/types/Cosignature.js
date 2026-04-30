/**
 * Cosign status type enum.
 * @typedef { 'awaiting_current_account' | 'awaiting_other_account' | 'signed_and_awaiting_other_account' 
 * | 'not_awaiting' | 'initiated_by_blocked_account' | 'initiated_by_unknown_account' } CosignStatusValue.
 */


const CosignStatus = {
	AWAITING_CURRENT_ACCOUNT: /** @type {CosignStatusValue} */('awaiting_current_account'),
	AWAITING_OTHER_ACCOUNT: /** @type {CosignStatusValue} */('awaiting_other_account'),
	SIGNED_AND_AWAITING_OTHER_ACCOUNT: /** @type {CosignStatusValue} */('signed_and_awaiting_other_account'),
	NOT_AWAITING: /** @type {CosignStatusValue} */('not_awaiting'),
	INITIATED_BY_BLOCKED_ACCOUNT: /** @type {CosignStatusValue} */('initiated_by_blocked_account'),
	INITIATED_BY_UNKNOWN_ACCOUNT: /** @type {CosignStatusValue} */('initiated_by_unknown_account')
};

export { CosignStatus };
