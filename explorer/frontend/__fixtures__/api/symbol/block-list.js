export const blockWithTransactionsResponse = {
	beneficiaryAddress: 'TBQLP7SU7WMUK3XYMIJZPWIT2HJ3PTVJPWFJNJQ',
	blockReward: 64.531245,
	difficulty: '12285449712472',
	harvester: 'TA2FRULNSAM4LRIT5UIX56VGDJP5OZ56Y4F6FPQ',
	hash: '6824AEC0BA95BF34409C91BB671EB0F1FF6EC43382F94850A5A7E1CE561E736C',
	height: 3778877,
	isFinalized: true,
	networkTimestamp: 124039691999,
	previousHash: '651559728532BF10BEDE36F86883A59F68E329CB86AB97AE90BD482C26D7E7FA',
	statementCount: 2,
	timestamp: '2026-10-06 12:35:58',
	totalFee: 0.0312,
	transactionCount: 1
};

export const emptyBlockResponse = {
	beneficiaryAddress: 'TA2ZNSZ7UDQ52X3D5XFMJDWQZRYABMNFMTZZNAA',
	blockReward: null,
	difficulty: '12195998925735',
	harvester: 'TA2ZNSZ7UDQ52X3D5XFMJDWQZRYABMNFMTZZNAA',
	hash: 'F4AE47B2591AD480030A914A10E89EB7DF4370908F3BAF59867CB72D1D70A175',
	height: 3778898,
	isFinalized: false,
	networkTimestamp: 124040306941,
	previousHash: '828658CA46766B37917E8421DB51037138B514CD4FDC44F1B0456D25BA854F74',
	statementCount: 1,
	timestamp: '2026-10-06 12:46:13',
	totalFee: 0,
	transactionCount: 0
};

export const blockListResponse = [
	emptyBlockResponse,
	blockWithTransactionsResponse
];
