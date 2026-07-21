/* eslint-disable max-len */
// Static stub data for the Symbol variant, which has no backend yet. These fixtures let the
// shared pages render (block cubes, tables, lists, charts) for visual/QA work without any network
// or node calls. The shapes mirror the mapped nem api output; the values are illustrative only.
import { SYMBOL_TRANSACTION_GROUP } from '../constants';

const harvester = 'NDE6Y5WNLHID5KRYN3AVNQ7U52XDXLQPHLXHV3OE';

export const stubBlocks = [
	{
		difficulty: '18.46', hash: '7568A97D319770D2BDE8CEAED519CCF9606FF46ED1B2FE40BD031C5FDAB0B3A0', height: 4695085,
		signature: 'B95DF092252A50EDBB23635F6A53FC378E8DEE5CA352CFD7C7550FD8D15D642F', signer: harvester,
		size: 168, timestamp: '2026-06-16 08:05:00', totalFees: 0.12, totalTransactions: 3,
		harvester, totalFee: 0.12, transactionCount: 3
	},
	{
		difficulty: '18.06', hash: 'BFE0196676C221CD09ED3B5FECBDB330C146BF632C35F87296D8F92C91866ADA', height: 4695084,
		signature: 'F5A3A0925BF7BEEF26B6B853311B4808D929BC5D817C701AD5FBBB44989975F9', signer: 'NBAEFLTJG3UWXNXHOLUUPSZIDEHB6VJYLLVW5DFG',
		size: 168, timestamp: '2026-06-16 08:04:11', totalFees: 0, totalTransactions: 0,
		harvester: 'NBAEFLTJG3UWXNXHOLUUPSZIDEHB6VJYLLVW5DFG', totalFee: 0, transactionCount: 0
	},
	{
		difficulty: '18.26', hash: '32BF8544E21078C23F27E4D37F9258B34476759C97C33E36844575DF196AA434', height: 4695083,
		signature: 'A53EDC64EE3496C64FC3AE60B412A407DE15BC9592C3F4E0B346D5948020A835', signer: 'NBKODY2QNE7XPK3CXX4LDLBTHFSOVJOEDKRH7IN3',
		size: 168, timestamp: '2026-06-16 08:03:20', totalFees: 0.05, totalTransactions: 1,
		harvester: 'NBKODY2QNE7XPK3CXX4LDLBTHFSOVJOEDKRH7IN3', totalFee: 0.05, transactionCount: 1
	},
	{
		difficulty: '19.22', hash: '972C395883DB8CB49376AB7E5811B9F63FA192F0AFFB6FAEC653B5060C00B005', height: 4695082,
		signature: 'F662F94DC437EDE126B92BDA1EB8954EE011FAE7721CAD71BB2A10E07B7A4299', signer: 'NA3BELQHNQTZGQ6YIKQ4BAOBXL6PK5PWNHZIEHQ3',
		size: 168, timestamp: '2026-06-16 08:02:35', totalFees: 0, totalTransactions: 0,
		harvester: 'NA3BELQHNQTZGQ6YIKQ4BAOBXL6PK5PWNHZIEHQ3', totalFee: 0, transactionCount: 0
	},
	{
		difficulty: '18.94', hash: '76D71C656C42953C8CFA718ECEAD74B8751AC8D39A68DFA3CD4A92FAAC868E2E', height: 4695081,
		signature: '0A4C7C5C4B9E1F2D3A6B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F', signer: harvester,
		size: 168, timestamp: '2026-06-16 08:01:50', totalFees: 0.2, totalTransactions: 5,
		harvester, totalFee: 0.2, transactionCount: 5
	},
	{
		difficulty: '18.7', hash: 'C0FFEE16676C221CD09ED3B5FECBDB330C146BF632C35F87296D8F92C9186BAD', height: 4695080,
		signature: '1B5DF092252A50EDBB23635F6A53FC378E8DEE5CA352CFD7C7550FD8D15D642F', signer: 'NBAEFLTJG3UWXNXHOLUUPSZIDEHB6VJYLLVW5DFG',
		size: 168, timestamp: '2026-06-16 08:00:55', totalFees: 0, totalTransactions: 0,
		harvester: 'NBAEFLTJG3UWXNXHOLUUPSZIDEHB6VJYLLVW5DFG', totalFee: 0, transactionCount: 0
	}
];

const transfer = (hash, sender, recipient, amount, timestamp, height) => ({
	type: 'TRANSFER', group: SYMBOL_TRANSACTION_GROUP.CONFIRMED, hash, timestamp, deadline: timestamp, signer: sender, sender, recipient,
	account: sender, direction: null, height, signature: 'D5C0D2CADA5DD4113A66307C9B34BF110162591D69DDF4315071BF600257A563',
	fee: 0.1, amount, value: [{ id: 'symbol.xym', name: 'symbol.xym', amount }],
	body: [{ type: 'TRANSFER', sender, recipient, mosaics: [{ id: 'symbol.xym', name: 'symbol.xym', amount }], message: null }]
});

export const stubTransactions = [
	transfer('ABADF5216044C97E4EFDECB12F1387F2FC6AEE810E07CDCD7C39CB266B931F88', 'NAHJICE3OGYPQFRWGDEEG6POMSIPB7I6STY55PFZ', 'NDABPHWFPH7KL5FADCW66V4GYLVXHKYQIPWL4G2B', 20979, '2026-06-16 08:05:48', 4695085),
	transfer('19DFA7AAD61024CCB564C41239CA865221A8984EE970FBDA0F492B09E4C70691', 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P', 'NCYAVMNQOZ3MZETEBD34ACMAX3S57WUSWAZWY3DW', 13200, '2026-06-16 08:03:25', 4695083),
	transfer('1D204FC80A4E5F1A319CC56EF1A9BE60B443A78F601AF83DAA7ACA7737E916E6', 'NALICE7GX3PF3WAOWVLXFOQ4ZMOBP7GUMNB2RCYQ', 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV', 5000000, '2026-06-16 08:01:55', 4695081),
	{
		type: 'MULTISIG_ACCOUNT_MODIFICATION', group: SYMBOL_TRANSACTION_GROUP.CONFIRMED, hash: '65E744B4F720A7B7ADBA413B6C4FCF38BDA1ED4124F1AEBEE5893B0D1D176C97',
		timestamp: '2026-06-16 07:59:10', deadline: '2026-06-16 07:59:10', signer: 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P',
		sender: 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P', recipient: null, account: 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P',
		direction: null, height: 4695079, signature: '65E744B4F720A7B7ADBA413B6C4FCF38BDA1ED4124F1AEBEE5893B0D1D176C97',
		fee: 0.34, amount: 0, value: [],
		body: [{
			type: 'MULTISIG_ACCOUNT_MODIFICATION', sender: 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P', targetAccount: 'NDSUSTAAB2GWHBUFJXP7QQGYHBVEFWZESBUUWM4P',
			cosignatoryAdditions: ['NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY'], cosignatoryDeletions: [], minCosignatories: 1
		}]
	}
];

export const stubAccounts = [
	{
		linkedAddress: null, address: 'NANEPSBUVE5NLYXCTP52LK3YAOSZUAIVOAD4FGSV', publicKey: '63D2E7B4F5479B0BF67AC34B0656F4A265B039CE66BF6CA9BDD7C196365D8E23',
		description: null, balance: 2014883839.88, vestedBalance: 1976248388.92, mosaics: [{ name: 'symbol.xym', id: 'symbol.xym', isCreatedByAccount: false, amount: 2014883839.88 }],
		importance: 21.07, harvestedBlocks: 1240, harvestedFees: 12.5, height: 4109488, minCosignatories: 0, cosignatoryOf: [], cosignatories: [], isMultisig: false, isHarvestingActive: true
	},
	{
		linkedAddress: null, address: 'NAXB67KOXSIDPNGTOJA35MTNCK4AHB6JE2MJRER7', publicKey: 'A47BF27A383D184C0630214E355EECF0859FEED161E1750E1AB9B624A874CE25',
		description: null, balance: 55692075.37, vestedBalance: 47667842.68, mosaics: [{ name: 'symbol.xym', id: 'symbol.xym', isCreatedByAccount: false, amount: 55692075.37 }],
		importance: 0.57, harvestedBlocks: null, harvestedFees: null, height: 4109001, minCosignatories: 0, cosignatoryOf: [], cosignatories: [], isMultisig: false, isHarvestingActive: false
	},
	{
		linkedAddress: null, address: 'NCHESTYVD2P6P646AMY7WSNG73PCPZDUQNSD6JAK', publicKey: 'B47BF27A383D184C0630214E355EECF0859FEED161E1750E1AB9B624A874CE26',
		description: null, balance: 980000.5, vestedBalance: 970000.0, mosaics: [{ name: 'symbol.xym', id: 'symbol.xym', isCreatedByAccount: false, amount: 980000.5 }],
		importance: 23.41, harvestedBlocks: 5400, harvestedFees: 88.2, height: 3990001, minCosignatories: 2, cosignatoryOf: [], cosignatories: ['NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY'], isMultisig: true, isHarvestingActive: true
	}
];

export const stubMosaics = [
	{
		id: 'symbol.xym', name: 'symbol.xym', namespaceName: 'symbol', rootNamespaceName: 'symbol', creator: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV',
		description: 'Native currency', divisibility: 6, initialSupply: 7842928625, supply: 7842928625, registrationHeight: 1, registrationTimestamp: 'Wed, 06 Mar 2024 04:58:02 GMT',
		namespaceRegistrationHeight: 1, namespaceExpirationHeight: 5186626, namespaceExpirationTimestamp: 'Wed, 06 Mar 2024 04:40:18 GMT', isUnlimitedDuration: true, isSupplyMutable: false, isTransferable: true, levy: null
	},
	{
		id: 'holo.watacoin', name: 'holo.watacoin', namespaceName: 'holo', rootNamespaceName: 'holo', creator: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV',
		description: 'watacoin', divisibility: 3, initialSupply: 10000000, supply: 10000000, registrationHeight: 4661037, registrationTimestamp: 'Wed, 06 Mar 2024 04:58:02 GMT',
		namespaceRegistrationHeight: 4661026, namespaceExpirationHeight: 5186626, namespaceExpirationTimestamp: 'Wed, 06 Mar 2024 04:40:18 GMT', isUnlimitedDuration: false, isSupplyMutable: true, isTransferable: true, levy: null
	}
];

export const stubNamespaces = [
	{
		name: 'symbol', id: 'symbol', creator: 'NALVKQFQLX4W724PKKMDDQWC7KETHUBLTR727MRM', subNamespaceCount: 1, subNamespaces: ['symbol.xym'],
		registrationTimestamp: '2024-03-25 20:17:11', registrationHeight: 1, expirationHeight: 5214679, isUnlimitedDuration: true, namespaceMosaics: []
	},
	{
		name: 'holo', id: 'holo', creator: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV', subNamespaceCount: 0, subNamespaces: [],
		registrationTimestamp: '2024-03-06 04:40:18', registrationHeight: 4661026, expirationHeight: 5186626, isUnlimitedDuration: false,
		namespaceMosaics: [{ namespaceId: 'holo', namespaceName: 'holo', data: [{ id: 'holo.watacoin', name: 'holo.watacoin', registrationHeight: 4661037, registrationTimestamp: '2024-03-06 04:58:02', supply: 10000000 }] }]
	}
];

export const stubNodes = [
	{ balance: 0, endpoint: 'http://symbol-node-1.example:7890', finalizedHeight: 4695000, height: 4695085, mainPublicKey: 'D13199221E62A97C65EEE5E3A8799FE353D11918A003ABE3F32F79D68B94608F', name: 'Sym1', nodePublicKey: 'A0D322205AC7374AAEBD8C913AFFB4A2A316C55FC5E1CF137468F2D524398C33', roles: 255, version: '1.0.3.5' },
	{ balance: 0, endpoint: 'http://symbol-node-2.example:7890', finalizedHeight: 4694900, height: 4695084, mainPublicKey: 'A7DA03C7ADC8AC430DA2332AD3D68C24D911C0A3E68D5A61CBF99D710DBCFEE8', name: 'Sym2', nodePublicKey: '3F04D922B36FCE9101D14D71547C3F1DA76D9271AF57902BB11E1EC53C7A0A52', roles: 255, version: '1.0.3.5' },
	{ balance: 0, endpoint: 'http://symbol-node-3.example:7890', finalizedHeight: 4694800, height: 4695083, mainPublicKey: 'CF2105FBDE6724B3826CE70FDD15671F6FA74B6EC040AE051A1B73B68D507D07', name: 'Sym3', nodePublicKey: 'C03C3C381D2ADFE865FF2168D3BDCEE1756F14B0B57611606910514EA0801976', roles: 255, version: '1.0.3.5' }
];

export const stubAccountStats = {
	total: 984546, harvesting: 23675, eligibleForHarvesting: 9093, top10AccountsImportance: 69.1, harvestingAccountsPercentage: 2.4,
	importanceBreakdown: [
		[21.07, 'NANEPSBUVE5NLYXCTP52LK3YAOSZUAIVOAD4FGSV'],
		[23.41, 'NCHESTYVD2P6P646AMY7WSNG73PCPZDUQNSD6JAK'],
		[0.57, 'NAXB67KOXSIDPNGTOJA35MTNCK4AHB6JE2MJRER7'],
		[54.95, 'Rest']
	],
	harvestingAccountsChart: [[2.4, 'Harvesting'], [97.6, 'Not harvesting']]
};

export const stubBlockStats = {
	blockTimeChart: stubBlocks.map((block, index) => [block.height, 20 + (index * 5)]).reverse(),
	blockFeeChart: stubBlocks.map(block => [block.height, block.totalFee]).reverse(),
	blockDifficultyChart: stubBlocks.map(block => [block.height, block.difficulty]).reverse(),
	blockTime: 30, blockFee: 0.094, blockDifficulty: '18.46'
};

export const stubTransactionStats = { averagePerBlock: 2, total: 10667593, last30Day: 17457, last24Hours: 630 };

export const stubMarketData = { price: 0.031, priceChange: 1.74, volume: 49221365.72, circulatingSupply: 7842928625, marketCap: 243130787.3, treasury: 0 };

export const stubTransactionChart = stubBlocks.map(block => [block.height, block.transactionCount]).reverse();
