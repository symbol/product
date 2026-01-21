import { tokens } from '__fixtures__/local/token';

export const networkProperties = {
	symbol: {
		mainnet: {
			nodeUrl: 'https://node.symbol.com:3000',
			wsUrl: 'wss://node.symbol.com:3000/ws',
			networkIdentifier: 'mainnet',
			generationHash: '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
			chainHeight: 9876543,
			blockGenerationTargetTime: '15',
			epochAdjustment: 1615853185,
			transactionFees: {
				averageFeeMultiplier: 100,
				medianFeeMultiplier: 100,
				highestFeeMultiplier: 200,
				lowestFeeMultiplier: 0,
				minFeeMultiplier: 100
			},
			networkCurrency: {
				...tokens.symbol.mainnet[0]
			}
		},
		testnet: {
			nodeUrl: 'https://xym-t.11ppm.com:3001',
			wsUrl: 'wss://xym-t.11ppm.com:3001/ws',
			networkIdentifier: 'testnet',
			generationHash: '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4',
			chainHeight: 1319595,
			blockGenerationTargetTime: '30',
			epochAdjustment: 1667250467,
			transactionFees: {
				averageFeeMultiplier: 100,
				medianFeeMultiplier: 100,
				highestFeeMultiplier: 203,
				lowestFeeMultiplier: 0,
				minFeeMultiplier: 100
			},
			networkCurrency: {
				...tokens.symbol.testnet[0]
			}
		}
	}
};
