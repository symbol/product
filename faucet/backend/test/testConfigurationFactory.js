const testConfigurationFactory = {
	createNetworkProperties: () => ({
		network: {
			identifier: 'testnet',
			nemesisSignerPublicKey: '76E94661562762111FF7E592B00398554973396D8A4B922F3E3D139892F7C35C',
			nodeEqualityStrategy: 'host',
			generationHashSeed: '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4',
			epochAdjustment: '1667250467s'
		},
		chain: {
			enableVerifiableState: true,
			enableVerifiableReceipts: true,
			currencyMosaicId: '0x72C0\'212E\'67A0\'8BCE',
			harvestingMosaicId: '0x72C0\'212E\'67A0\'8BCE',
			blockGenerationTargetTime: '30s',
			blockTimeSmoothingFactor: '3000',
			importanceGrouping: '180',
			importanceActivityPercentage: '5',
			maxRollbackBlocks: '0',
			maxDifficultyBlocks: '60',
			defaultDynamicFeeMultiplier: '100',
			maxTransactionLifetime: '6h',
			maxBlockFutureTime: '300ms',
			initialCurrencyAtomicUnits: '7\'842\'928\'625\'000\'000',
			maxMosaicAtomicUnits: '8\'999\'999\'999\'000\'000',
			totalChainImportance: '7\'842\'928\'625\'000\'000',
			minHarvesterBalance: '10\'000\'000\'000',
			maxHarvesterBalance: '50\'000\'000\'000\'000',
			minVoterBalance: '3\'000\'000\'000\'000',
			votingSetGrouping: '720',
			maxVotingKeysPerAccount: '3',
			minVotingKeyLifetime: '28',
			maxVotingKeyLifetime: '720',
			harvestBeneficiaryPercentage: '25',
			harvestNetworkPercentage: '5',
			harvestNetworkFeeSinkAddressV1: 'TBC3AX4TMSYWTCWR6LDHPKWQQL7KPCOMHECN2II',
			harvestNetworkFeeSinkAddress: 'TBC3AX4TMSYWTCWR6LDHPKWQQL7KPCOMHECN2II',
			maxTransactionsPerBlock: '6\'000'
		},
		plugins: {
			accountlink: {
				dummy: 'to trigger plugin load'
			},
			aggregate: {
				maxTransactionsPerAggregate: '100',
				maxCosignaturesPerAggregate: '25',
				enableStrictCosignatureCheck: false,
				enableBondedAggregateSupport: true,
				maxBondedTransactionLifetime: '48h'
			},
			lockhash: {
				lockedFundsPerAggregate: '10\'000\'000',
				maxHashLockDuration: '2d'
			},
			locksecret: {
				maxSecretLockDuration: '365d',
				minProofSize: '0',
				maxProofSize: '1024'
			},
			metadata: {
				maxValueSize: '1024'
			},
			mosaic: {
				maxMosaicsPerAccount: '1\'000',
				maxMosaicDuration: '3650d',
				maxMosaicDivisibility: '6',
				mosaicRentalFeeSinkAddressV1: 'TA53AVLYMT5HCP5TJ23CGKGTUXQHNPBTJ4Z2LIQ',
				mosaicRentalFeeSinkAddress: 'TA53AVLYMT5HCP5TJ23CGKGTUXQHNPBTJ4Z2LIQ',
				mosaicRentalFee: '500000'
			},
			multisig: {
				maxMultisigDepth: '3',
				maxCosignatoriesPerAccount: '25',
				maxCosignedAccountsPerAccount: '25'
			},
			namespace: {
				maxNameSize: '64',
				maxChildNamespaces: '100',
				maxNamespaceDepth: '3',
				minNamespaceDuration: '30d',
				maxNamespaceDuration: '1825d',
				namespaceGracePeriodDuration: '1d',
				reservedRootNamespaceNames: 'symbol, symbl, xym, xem, nem, user, account, org, com, biz, net, edu, mil, gov, info',
				namespaceRentalFeeSinkAddressV1: 'TDVFW6NZN3YI6O4ZRYZHGY73KADCW4HX6IDIKZI',
				namespaceRentalFeeSinkAddress: 'TDVFW6NZN3YI6O4ZRYZHGY73KADCW4HX6IDIKZI',
				rootNamespaceRentalFeePerBlock: '2',
				childNamespaceRentalFee: '100000'
			},
			restrictionaccount: {
				maxAccountRestrictionValues: '100'
			},
			restrictionmosaic: {
				maxMosaicRestrictionValues: '20'
			},
			transfer: {
				maxMessageSize: '1024'
			}
		},
		forkHeights: {
			totalVotingBalanceCalculationFix: '0',
			treasuryReissuance: '0',
			strictAggregateTransactionHash: '0'
		}
	}),
	createUnconfirmedTransferTransactions: () => ({
		data: [
			{
				meta: {
					height: '0',
					hash: 'C192657CCBFADFBBAACD059F54E122994E1D9B6DF449B9D12973D61CA7804D62',
					merkleComponentHash: 'C192657CCBFADFBBAACD059F54E122994E1D9B6DF449B9D12973D61CA7804D62',
					index: 0
				},
				transaction: {
					size: 181,
					signature: 'FB8A5E1EF43E6A1CCE7799BF4DE7F219EDC970558099053D559213D47F2119A747DDF3'
                            + 'CB3FF912A6E45D82880FE16F35BCA9CFF282DDE3F7F487F17B1787630F',
					signerPublicKey: '54F65566363F0B6EC81E4D06B20401E468E762AB49923541631B485268E576C8',
					version: 1,
					network: 152,
					type: 16724,
					maxFee: '4525',
					deadline: '5013678388',
					recipientAddress: '9857E773A8D9D7A4EEFB5BE351100496E5E54ECB6E7FE68E',
					message: '0074657374',
					mosaics: [
						{
							id: '72C0212E67A08BCE',
							amount: '0'
						}
					]
				},
				id: '63AC9DB555EC2DE47B1A358F'
			}
		],
		pagination: {
			pageNumber: 1,
			pageSize: 10
		}
	}),
	createAccountInfo: mosaics => ({
		account: {
			version: 1,
			address: '98E3603E3423FE325578A8AC3679C3E44C29312C67364FBE',
			addressHeight: '17373',
			publicKey: 'ACED02C31BEFA9E037AA9FC32D8476C4FE44C3707132751C3909A2F88E1FF013',
			publicKeyHeight: '115243',
			accountType: 0,
			supplementalPublicKeys: {},
			activityBuckets: [],
			mosaics,
			importance: '0',
			importanceHeight: '0'
		},
		id: '63AD267B12D2327FBE400F81'
	})
};

export default testConfigurationFactory;
