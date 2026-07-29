/* eslint-disable max-len */
import { accounts } from './wallet';

const { alice: signerAccount, bob: recipientAccount, carol: secondRecipientAccount } = accounts;

const erc20TokenAddress = '0x6fe1f90116fd1225c4b713a6efb3f87dce77b445';
const swapRouterAddress = '0xe592427a0aece92de3edee1f18e0157c05861564';
const wethTokenAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const targetTokenAddress = '0x5e8343a455f03109b737b6d8b410e4ecce998cda';

// Bridge message payload (the base32 recipient on the destination chain, appended to the ERC-20 call data).
const bridgePayload = '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6';
const swapDeadline = 1700000600;
const chainId = 11155111;

// EIP-1559 fee multiplier shared by the app transactions below.
const baseFee = {
	gasLimit: 21000,
	maxFeePerGas: '3',
	maxPriorityFeePerGas: '1'
};

//
// App transactions (input to transactionToEthereum / signTransaction).
//

// Native ETH transfer (TransactionType.TRANSFER).
export const transferTransaction = {
	type: 1,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	recipientAddress: recipientAccount.address,
	tokens: [{ id: 'ETH', amount: '1.5', divisibility: 18 }],
	nonce: 0,
	fee: baseFee
};

// ERC-20 token transfer (TransactionType.ERC_20_TRANSFER).
export const erc20TransferTransaction = {
	type: 2,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	recipientAddress: secondRecipientAccount.address,
	tokens: [{ id: erc20TokenAddress, amount: '10', divisibility: 6 }],
	nonce: 1,
	fee: baseFee
};

// ERC-20 transfer carrying a bridge message payload (TransactionType.ERC_20_BRIDGE_TRANSFER).
export const erc20BridgeTransferTransaction = {
	type: 3,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	recipientAddress: secondRecipientAccount.address,
	tokens: [{ id: erc20TokenAddress, amount: '0.02', divisibility: 6 }],
	message: { payload: bridgePayload },
	nonce: 2,
	fee: baseFee
};

// Uniswap swap with an ERC-20 source token (TransactionType.UNISWAP_SWAP).
export const uniswapSwapTransaction = {
	type: 4,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	recipientAddress: signerAccount.address,
	routerAddress: swapRouterAddress,
	sourceToken: { id: wethTokenAddress, amount: '1', divisibility: 18 },
	targetToken: { id: targetTokenAddress, amount: '0', divisibility: 6 },
	poolFee: 3000,
	deadline: swapDeadline,
	sqrtPriceLimitX96: 0,
	nonce: 3,
	fee: baseFee
};

// Uniswap swap with native ETH as the source token, wrapped to WETH (TransactionType.UNISWAP_SWAP).
export const uniswapNativeSwapTransaction = {
	type: 4,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	recipientAddress: signerAccount.address,
	routerAddress: swapRouterAddress,
	sourceToken: { id: 'eth', amount: '0.001', divisibility: 18 },
	targetToken: { id: targetTokenAddress, amount: '0', divisibility: 6 },
	poolFee: 3000,
	deadline: swapDeadline,
	sqrtPriceLimitX96: 0,
	nonce: 4,
	fee: baseFee,
	wethTokenId: wethTokenAddress
};

// ERC-20 spending approval (TransactionType.ERC_20_APPROVE).
export const erc20ApproveTransaction = {
	type: 5,
	signerPublicKey: signerAccount.publicKey,
	signerAddress: signerAccount.address,
	tokenId: erc20TokenAddress,
	spenderAddress: swapRouterAddress,
	amount: '10',
	divisibility: 6,
	nonce: 5,
	fee: baseFee
};

export const walletTransactions = [
	transferTransaction,
	erc20TransferTransaction,
	erc20BridgeTransferTransaction,
	uniswapSwapTransaction,
	uniswapNativeSwapTransaction,
	erc20ApproveTransaction
];

//
// Expected ethers-format transactions, index-aligned with walletTransactions.
//

const baseEthereumFee = {
	gasLimit: 21000n,
	maxFeePerGas: 3000000000000000000n,
	maxPriorityFeePerGas: 1000000000000000000n
};

export const transferEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 0,
	...baseEthereumFee,
	to: recipientAccount.address,
	value: 1500000000000000000n
};

export const erc20TransferEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 1,
	...baseEthereumFee,
	to: erc20TokenAddress,
	value: 0n,
	data: '0xa9059cbb000000000000000000000000c5d9cf0ee687e357aea5d26592f8bc9fe32abaa20000000000000000000000000000000000000000000000000000000000989680'
};

export const erc20BridgeTransferEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 2,
	...baseEthereumFee,
	to: erc20TokenAddress,
	value: 0n,
	data: '0xa9059cbb000000000000000000000000c5d9cf0ee687e357aea5d26592f8bc9fe32abaa20000000000000000000000000000000000000000000000000000000000004e20982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6'
};

export const uniswapSwapEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 3,
	...baseEthereumFee,
	to: swapRouterAddress,
	value: 0n,
	data: '0x5ae401dc000000000000000000000000000000000000000000000000000000006553f35800000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e404e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000005e8343a455f03109b737b6d8b410e4ecce998cda0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000b1b2145b7d2ba5ab20ee0bcb0f7fad08a1bfc7a40000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
};

// Native-input multicall carries two inner calls: exactInputSingle followed by refundETH.
export const uniswapNativeSwapEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 4,
	...baseEthereumFee,
	to: swapRouterAddress,
	value: 1000000000000000n,
	data: '0x5ae401dc000000000000000000000000000000000000000000000000000000006553f358000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000e404e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000005e8343a455f03109b737b6d8b410e4ecce998cda0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000b1b2145b7d2ba5ab20ee0bcb0f7fad08a1bfc7a400000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412210e8a00000000000000000000000000000000000000000000000000000000'
};

export const erc20ApproveEthereumTransaction = {
	from: signerAccount.address,
	chainId,
	nonce: 5,
	...baseEthereumFee,
	to: erc20TokenAddress,
	value: 0n,
	data: '0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000000989680'
};

export const ethereumTransactions = [
	transferEthereumTransaction,
	erc20TransferEthereumTransaction,
	erc20BridgeTransferEthereumTransaction,
	uniswapSwapEthereumTransaction,
	uniswapNativeSwapEthereumTransaction,
	erc20ApproveEthereumTransaction
];

//
// Expected signed transactions (RLP-encoded dto + hash), index-aligned with walletTransactions.
//

export const signedTransactions = [
	{
		dto: '0x02f87d83aa36a780880de0b6b3a76400008829a2241af62c00008252089438f3fa5dfb5359f8425bc90b4ebdeaf96d0670c48814d1120d7b16000080c080a00c4b4f84714ddc35b9abfe7b36a90be48d24ba8a199a8db6d55d7237712b3fb5a05da5cb428a8c4eb964f98f94d86ba7b3b44d385f94b08684f1f8d213284c91de',
		hash: '0xb02d9a981e0fc48f9da5a529a264129554f987d803a2d936b949318073b9ce31'
	},
	{
		dto: '0x02f8ba83aa36a701880de0b6b3a76400008829a2241af62c0000825208946fe1f90116fd1225c4b713a6efb3f87dce77b44580b844a9059cbb000000000000000000000000c5d9cf0ee687e357aea5d26592f8bc9fe32abaa20000000000000000000000000000000000000000000000000000000000989680c001a0a851bae5436f8e0d0ba7a55842e6303c2a233c50b086be30bd78e577a43834daa054ed86ca052666330a264eda5443e5b5c640282782258018f63783c962e05db8',
		hash: '0xa8f1686a6eb04257be450ccd0e2af6aee4bcb676e833d84dbe3daf57a5acc564'
	},
	{
		dto: '0x02f8d283aa36a702880de0b6b3a76400008829a2241af62c0000825208946fe1f90116fd1225c4b713a6efb3f87dce77b44580b85ca9059cbb000000000000000000000000c5d9cf0ee687e357aea5d26592f8bc9fe32abaa20000000000000000000000000000000000000000000000000000000000004e20982c69a051a72bfbe31aeda7250ac6c747b7570b3e9c00b6c080a07414665e7820103044e726541c047196064ccf18e0f756ab677f7cc7fa7d22a8a01804540be3841421d8c995d51927162a7b6c0917b1ad99b467ad77f4927c6bdf',
		hash: '0x7c5c11f0dbf22a5c243d80f37316df9a74f60bc4948e5f72852e716bc5bbad67'
	},
	{
		dto: '0x02f9021b83aa36a703880de0b6b3a76400008829a2241af62c000082520894e592427a0aece92de3edee1f18e0157c0586156480b901a45ae401dc000000000000000000000000000000000000000000000000000000006553f35800000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e404e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000005e8343a455f03109b737b6d8b410e4ecce998cda0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000b1b2145b7d2ba5ab20ee0bcb0f7fad08a1bfc7a40000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c001a01aace556fb9115a7abb8c039a5ffca5b09dc7d0102c23a4e20fe2e280b40b7c5a05c281f4a6c3ccb27ad2ad01b0d277747b1c547357c9ed713a58a45d737d10449',
		hash: '0x3dec5b18bb2e745bf5d81fe6312efdd289dfc95215e8e3911a65b5f4fe53ca06'
	},
	{
		dto: '0x02f9028283aa36a704880de0b6b3a76400008829a2241af62c000082520894e592427a0aece92de3edee1f18e0157c0586156487038d7ea4c68000b902045ae401dc000000000000000000000000000000000000000000000000000000006553f358000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000e404e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000005e8343a455f03109b737b6d8b410e4ecce998cda0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000b1b2145b7d2ba5ab20ee0bcb0f7fad08a1bfc7a400000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412210e8a00000000000000000000000000000000000000000000000000000000c080a0584aaa4316815b6c19f48c094a998cc523c9c795dd85528e9ac4e7088d83d1b7a02849ee4e82f4712c425fcc833f39bc51b8e37f539393642dc773c8588a1316d9',
		hash: '0x9a0eb2d3858b57a21963e1adc8fe8cb9ba359bcceced55914009722ccadbc6bb'
	},
	{
		dto: '0x02f8ba83aa36a705880de0b6b3a76400008829a2241af62c0000825208946fe1f90116fd1225c4b713a6efb3f87dce77b44580b844095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000000989680c080a0733b08907dcc81cda46b938f8224e89dedff8dc23fcc3328495ad240bd0d035aa0331e7096941e780f1fcb950d56a720beaeae6c019c470ad5a346bfb66720ee40',
		hash: '0x771674b9568095f6ea636be28aae244cc3a45bf96d4065fdfbc3893cb44ae751'
	}
];

//
// Expected app transactions decoded from API DTOs (output of transactionFromDTO),
// index-aligned with the `transactionResponses` fixture.
//

const etherRecipientAddress = '0xcef7462dbdca4c19b66012c70d1541a33606e9ad';
const bridgeRecipientAddress = '0x9b5b717fec711af80050986d1306d5c8fb9fa953';

export const etherTransaction = {
	height: '251023',
	hash: '0x03adaec8595e907da0d19ad354ca4b67f94ddf79c79e40ad8b37a5ee3b1e7478',
	nonce: '19',
	signerAddress: signerAccount.address,
	fee: {
		gasLimit: '21000',
		maxFeePerGas: '0.00000000000000001',
		maxPriorityFeePerGas: '0',
		token: {
			amount: '0.00000000000021',
			id: 'ETH',
			name: 'ETH',
			divisibility: 18
		}
	},
	timestamp: 1759844024000,
	type: 1,
	tokens: [{ name: 'ETH', id: 'ETH', divisibility: 18, amount: '0.1979990999942376' }],
	recipientAddress: etherRecipientAddress
};

export const erc20Transaction = {
	height: '251181',
	hash: '0xc778bb5dac6ab4b4c881cbe62941c152f39819ede4fe85517d237def2da0af3e',
	nonce: '20',
	signerAddress: signerAccount.address,
	fee: {
		gasLimit: '40069',
		maxFeePerGas: '0.000000000000000014',
		maxPriorityFeePerGas: '0',
		token: {
			amount: '0.000000000000560966',
			id: 'ETH',
			name: 'ETH',
			divisibility: 18
		}
	},
	timestamp: 1759845920000,
	type: 2,
	tokens: [{ id: targetTokenAddress, name: 'bXYM', divisibility: 6, amount: '12' }],
	recipientAddress: etherRecipientAddress
};

export const bridgeTransaction = {
	height: '249648',
	hash: '0x3a99098a33bf68fcf41476dcf6adf58320700c7695d27fc4722b42d3bc118478',
	nonce: '18',
	signerAddress: signerAccount.address,
	fee: {
		gasLimit: '45908',
		maxFeePerGas: '0.00000000000000001',
		maxPriorityFeePerGas: '0',
		token: {
			amount: '0.00000000000045908',
			id: 'ETH',
			name: 'ETH',
			divisibility: 18
		}
	},
	timestamp: 1759827524000,
	type: 3,
	tokens: [{ id: targetTokenAddress, name: 'bXYM', divisibility: 6, amount: '0.02' }],
	recipientAddress: bridgeRecipientAddress,
	message: {
		payload: '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6',
		text: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ'
	}
};

export const decodedTransactions = [
	etherTransaction,
	erc20Transaction,
	bridgeTransaction
];
