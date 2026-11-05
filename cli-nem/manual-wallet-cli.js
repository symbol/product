#!/usr/bin/env node


/// THIS IS JUST A DRAFT VERSION CREATED BY AI TO MANUALLY test wallet-common-nem project and EXECUTE SOME API CALLS USING WALLET_COMMON_NEM. IT SHOULD TEST API CALLS VIA SERVICES, UTILS FILES CORRECTNESS and TransferModule. Something might be wrong with this file so alvays be sceptical about responses. always reference nem-documentation.html where documented majority of NIS NEM API endpoints. Fell free to rewrite this file. This is temporary AI helper.


import { Api } from '../src/api/index.js';
import {
	LinkAction,
	MULTISIG_TRANSACTION_DEADLINE_HOURS,
	MosaicSupplyChangeAction,
	MultisigAccountModificationType,
	NetworkIdentifier,
	SINGLE_TRANSACTION_DEADLINE_HOURS,
	TransactionGroup,
	TransactionType
} from '../src/constants/index.js';
import { TransferModule } from '../src/modules/TransferModule.js';
import { createWalletAccount, generateKeyPair } from '../src/utils/account.js';
import { calculateTransactionFee, createTransactionFee } from '../src/utils/fee.js';
import { cosignTransaction, createDeadline, decryptMessage, encryptMessage, signTransaction, signTransactionBundle } from '../src/utils/transaction.js';
import {
	InternalServerError,
	InvalidRequestError,
	NetworkRequestError,
	NotFoundError,
	RateLimitError,
	absoluteToRelativeAmount
} from 'wallet-common-core';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const ACCOUNT_TYPE = 'mnemonic';
const DEFAULT_COMMAND = 'overview';
const DEFAULT_MARKET_CURRENCIES = ['USD'];
const DEFAULT_NODE_LIST = {
	[NetworkIdentifier.MAIN_NET]: [],
	[NetworkIdentifier.TEST_NET]: [
		'http://20.243.209.158:7890',
		'http://libertalia.nemtest.net:7890',
		'http://ntn1.dusanjp.com:7890',
		'http://ntn2.dusanjp.com:7890',
		'http://ocracoke.nemtest.net:7890',
		'http://tortuga.nemtest.net:7890',
		'http://hugetestalice.nem.ninja:7890',
		'http://hugetestalice2.nem.ninja:7890',
		'http://medalice2.nem.ninja:7890'
	]
};
const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_WALLET_DATA_PATH = new URL('../TEST_WALLET_DATA.md', import.meta.url);
const Direction = {
	ALL: 'all',
	INCOMING: 'incoming',
	OUTGOING: 'outgoing'
};
// NEM testnet fee sinks (rental/creation fees are paid here, separately from the tx fee), per the NEM docs.
const FEE_SINK = {
	namespace: { [NetworkIdentifier.TEST_NET]: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35' },
	mosaic: { [NetworkIdentifier.TEST_NET]: 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC' }
};

const Command = {
	ACCOUNT_INFO: 'account-info',
	ACCOUNT_KEY_LINK: 'account-key-link',
	COSIGN: 'cosign',
	CREATE_MULTISIG: 'create-multisig',
	DECRYPT_MESSAGE: 'decrypt-message',
	LISTEN: 'listen',
	MOSAIC_DEFINITION: 'mosaic-definition',
	MOSAIC_SUPPLY_CHANGE: 'mosaic-supply-change',
	MULTISIG_MODIFICATION: 'multisig-modification',
	MULTISIG_TRANSFER: 'multisig-transfer',
	OVERVIEW: 'overview',
	REGISTER_NAMESPACE: 'register-namespace',
	SEND_TRANSFER: 'send-transfer',
	SERVICES: 'services',
	TRANSACTIONS: 'transactions'
};
const PlannedCommand = {
	CREATE_MULTISIG: 'create-multisig',
	SEND_MULTISIG_TRANSFER: 'send-multisig-transfer',
	SEND_TRANSFER: 'send-transfer'
};
const NetworkLabel = {
	[NetworkIdentifier.MAIN_NET]: 'Mainnet',
	[NetworkIdentifier.TEST_NET]: 'Testnet'
};

const HELP_TEXT = [
	'CLI for manual wallet-common-nem smoke testing against a live NEM node.',
	'',
	'Usage:',
	'  node --loader ./.tmp-node-resolve-loader.mjs ./scripts/manual-wallet-cli.js <command> [options]',
	'',
	'Commands:',
	`  ${Command.OVERVIEW}      Fetch account info and recent transactions for one fixture account.`,
	`  ${Command.ACCOUNT_INFO}  Fetch account info only.`,
	`  ${Command.TRANSACTIONS}  Fetch recent transaction history only.`,
	'',
	'Options:',
	'  --network <testnet|mainnet>   Wallet fixture network. Defaults to testnet.',
	'  --index <number>              Fixture account index. Defaults to 0.',
	'  --node-url <url>              NEM node URL. Optional when built-in nodes or nodewatch are available.',
	'  --wallet-data <path>          Path to TEST_WALLET_DATA.md. Defaults to the package file.',
	`  --group <${Object.values(TransactionGroup).join('|')}>     Transaction group. Defaults to confirmed.`,
	`  --direction <${Object.values(Direction).join('|')}>     Transaction direction. Defaults to all.`,
	`  --page-number <number>        Transaction page number. Defaults to ${DEFAULT_PAGE_NUMBER}.`,
	`  --page-size <number>          Transaction page size. Defaults to ${DEFAULT_PAGE_SIZE}.`,
	'  --help                        Print this help output.',
	'',
	'Environment fallback for node discovery:',
	'  NEM_NODEWATCH_TESTNET_URL',
	'  NEM_NODEWATCH_MAINNET_URL',
	'  NEM_MARKET_DATA_URL',
	'  NEM_MARKET_CURRENCIES',
	'',
	'Built-in node fallback:',
	'  testnet: http://hugetestalice.nem.ninja:7890, http://hugetestalice2.nem.ninja:7890, http://medalice2.nem.ninja:7890',
	'',
	'Planned later commands, intentionally not implemented yet:',
	`  ${PlannedCommand.SEND_TRANSFER}`,
	`  ${PlannedCommand.CREATE_MULTISIG}`,
	`  ${PlannedCommand.SEND_MULTISIG_TRANSFER}`
].join('\n');

/**
 * Writes a line to stdout.
 * @param {string} text - The text to write.
 * @returns {void}
 */
const writeStdout = text => {
	process.stdout.write(`${text}\n`);
};

/**
 * Writes a line to stderr.
 * @param {string} text - The text to write.
 * @returns {void}
 */
const writeStderr = text => {
	process.stderr.write(`${text}\n`);
};

/**
 * Makes a JSON HTTP request.
 * @param {string} url - The request URL.
 * @param {object} [options] - The request options.
 * @returns {Promise<any>} The parsed response body.
 */
const makeRequest = async (url, options = {}) => {
	const response = await fetch(url, options);
	const rawText = await response.text();
	let jsonData = null;
	let errorMessageText = null;

	try {
		jsonData = JSON.parse(rawText);
	} catch {}

	if (response.ok && jsonData)
		return jsonData;

	if (!response.ok && jsonData)
		errorMessageText = jsonData.message || jsonData.error;

	if (!response.ok && !errorMessageText)
		errorMessageText = response.statusText;

	switch (response.status) {
	case 400:
	case 409:
		throw new InvalidRequestError(errorMessageText, response.status);
	case 404:
		throw new NotFoundError(errorMessageText, response.status);
	case 429:
		throw new RateLimitError(errorMessageText, response.status);
	case 500:
	case 502:
		throw new InternalServerError(errorMessageText, response.status);
	default:
		throw new NetworkRequestError(errorMessageText, response.status);
	}
};

/**
 * Creates the API config used by the CLI.
 * @returns {object} The API config.
 */
const createApiConfig = () => ({
	marketDataURL: process.env.NEM_MARKET_DATA_URL ?? 'https://min-api.cryptocompare.com/data/price',
	marketCurrencies: (process.env.NEM_MARKET_CURRENCIES ?? DEFAULT_MARKET_CURRENCIES.join(','))
		.split(',')
		.map(value => value.trim())
		.filter(Boolean),
	nodeList: DEFAULT_NODE_LIST,
	nodewatchURL: {
		[NetworkIdentifier.MAIN_NET]: process.env.NEM_NODEWATCH_MAINNET_URL ?? '',
		[NetworkIdentifier.TEST_NET]: process.env.NEM_NODEWATCH_TESTNET_URL ?? ''
	}
});

/**
 * Parses CLI arguments.
 * @param {string[]} argv - The raw CLI arguments.
 * @returns {{ command: string, options: Record<string, string | boolean> }} The parsed command and options.
 */
const parseArguments = argv => {
	const options = {};
	const positional = [];

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];

		if (!token.startsWith('--')) {
			positional.push(token);
			continue;
		}

		const [rawKey, inlineValue] = token.slice(2).split('=');
		if (!rawKey)
			continue;

		if (inlineValue !== undefined) {
			options[rawKey] = inlineValue;
			continue;
		}

		const nextToken = argv[index + 1];
		if (!nextToken || nextToken.startsWith('--')) {
			options[rawKey] = true;
			continue;
		}

		options[rawKey] = nextToken;
		index += 1;
	}

	if (positional.length > 1)
		throw new Error(`Unexpected positional arguments: ${positional.slice(1).join(', ')}`);

	return {
		command: positional[0] ?? DEFAULT_COMMAND,
		options
	};
};

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extracts a markdown section body by heading text.
 * @param {string} markdown - The markdown document.
 * @param {string} heading - The section heading without leading hashes.
 * @returns {string} The section body.
 */
const extractSection = (markdown, heading) => {
	const headingPattern = escapeRegExp(heading);
	const match = markdown.match(new RegExp(`## ${headingPattern}\\n\\n([\\s\\S]*?)(?=\\n## |$)`));

	if (!match)
		throw new Error(`Missing markdown section: ${heading}`);

	return match[1].trim();
};

/**
 * Parses a numbered markdown list.
 * @param {string} section - The section body.
 * @returns {string[]} The parsed values.
 */
const parseNumberedList = section => section
	.split('\n')
	.map(line => line.trim())
	.filter(Boolean)
	.map(line => {
		const match = line.match(/^\d+\.\s+(.+)$/);

		if (!match)
			throw new Error(`Expected numbered list item, received "${line}"`);

		return match[1];
	});

/**
 * Parses a JSON code block inside a markdown section.
 * @param {string} section - The section body.
 * @returns {object[] | null} The parsed JSON array, or null when absent.
 */
const parseJsonCodeBlock = section => {
	const match = section.match(/```json\n([\s\S]*?)\n```/);

	if (!match)
		return null;

	return JSON.parse(match[1]);
};

const assertWalletAccountMatchesFixture = (walletAccount, fixtureAccount, networkIdentifier, index) => {
	const comparableActual = {
		accountType: walletAccount.accountType,
		address: walletAccount.address,
		index: walletAccount.index,
		name: walletAccount.name,
		networkIdentifier: walletAccount.networkIdentifier,
		publicKey: walletAccount.publicKey
	};
	const comparableExpected = {
		accountType: fixtureAccount.accountType,
		address: fixtureAccount.address,
		index: fixtureAccount.index,
		name: fixtureAccount.name,
		networkIdentifier: fixtureAccount.networkIdentifier,
		publicKey: fixtureAccount.publicKey
	};

	if (JSON.stringify(comparableActual) !== JSON.stringify(comparableExpected)) {
		throw new Error(`Fixture wallet account mismatch for ${networkIdentifier} index ${index}: `
			+ `${JSON.stringify(comparableActual)} !== ${JSON.stringify(comparableExpected)}`);
	}
};

/**
 * Loads wallet entries from the markdown fixture.
 * @param {string | URL} walletDataPath - The markdown file path.
 * @returns {Promise<Record<string, Array<{index: number, privateKey: string, walletAccount: object}>>>} The wallet entries.
 */
const loadWalletEntries = async walletDataPath => {
	const markdown = await readFile(walletDataPath, 'utf8');

	return Object.values(NetworkIdentifier).reduce((result, networkIdentifier) => {
		const networkLabel = NetworkLabel[networkIdentifier];
		const privateKeys = parseNumberedList(extractSection(markdown, `${networkLabel} Private Keys`));
		const fixtureAccounts = parseJsonCodeBlock(extractSection(markdown, `${networkLabel} Wallet Accounts`)) ?? [];

		result[networkIdentifier] = privateKeys.map((privateKey, index) => {
			const fixtureAccount = fixtureAccounts.find(account => account.index === index) ?? fixtureAccounts[index] ?? null;
			const name = fixtureAccount?.name ?? `${networkLabel} Account ${index + 1}`;
			const walletAccount = createWalletAccount(privateKey, networkIdentifier, name, ACCOUNT_TYPE, index);

			if (fixtureAccount)
				assertWalletAccountMatchesFixture(walletAccount, fixtureAccount, networkIdentifier, index);

			return {
				index,
				privateKey,
				walletAccount
			};
		});

		return result;
	}, {});
};

const parseNetworkIdentifier = rawValue => {
	const networkIdentifier = String(rawValue ?? NetworkIdentifier.TEST_NET).toLowerCase();
	const supportedNetworks = Object.values(NetworkIdentifier);

	if (!supportedNetworks.includes(networkIdentifier)) 
		throw new Error(`Unsupported network "${rawValue}". Expected one of: ${supportedNetworks.join(', ')}`);
	

	return networkIdentifier;
};

const parsePositiveInteger = (rawValue, optionName, defaultValue) => {
	if (rawValue === undefined)
		return defaultValue;

	const parsedValue = Number.parseInt(String(rawValue), 10);
	if (!Number.isInteger(parsedValue) || parsedValue < 0)
		throw new Error(`Option --${optionName} must be a non-negative integer`);

	return parsedValue;
};

const parseTransactionGroup = rawValue => {
	const group = String(rawValue ?? TransactionGroup.CONFIRMED).toLowerCase();
	const supportedGroups = Object.values(TransactionGroup);

	if (!supportedGroups.includes(group))
		throw new Error(`Unsupported transaction group "${rawValue}". Expected one of: ${supportedGroups.join(', ')}`);

	return group;
};

const parseDirection = rawValue => {
	const direction = String(rawValue ?? Direction.ALL).toLowerCase();
	const supportedDirections = Object.values(Direction);

	if (!supportedDirections.includes(direction)) 
		throw new Error(`Unsupported direction "${rawValue}". Expected one of: ${supportedDirections.join(', ')}`);
	

	return direction;
};

const createTransferModuleHarness = (api, networkProperties, walletEntry) => {
	const transferModule = new TransferModule();
	transferModule.init({
		api,
		walletController: {
			currentAccount: walletEntry.walletAccount,
			networkProperties,
			encryptMessage: async (messageText, recipientPublicKey) =>
				encryptMessage(messageText, recipientPublicKey, walletEntry.privateKey),
			decryptMessage: async (encryptedMessageHex, publicKey) =>
				decryptMessage(encryptedMessageHex, publicKey, walletEntry.privateKey)
		}
	});

	return transferModule;
};

const resolveWalletEntry = (walletEntries, networkIdentifier, index) => {
	const entry = walletEntries[networkIdentifier]?.find(walletEntry => walletEntry.index === index);

	if (!entry)
		throw new Error(`No wallet fixture entry found for ${networkIdentifier} index ${index}`);

	return entry;
};

const normalizeNodeUrl = nodeUrl => String(nodeUrl).replace(/\/$/, '');

const findReachableNodeUrl = async (api, nodeUrls) => {
	let lastError = null;

	for (const candidateNodeUrl of nodeUrls) {
		const normalizedNodeUrl = normalizeNodeUrl(candidateNodeUrl);

		try {
			await api.network.pingNode(normalizedNodeUrl);

			return {
				lastError: null,
				nodeUrl: normalizedNodeUrl
			};
		} catch (error) {
			lastError = error;
		}
	}

	return {
		lastError,
		nodeUrl: null
	};
};

const resolveNodeUrl = async (api, config, networkIdentifier, rawNodeUrl) => {
	if (rawNodeUrl)
		return normalizeNodeUrl(rawNodeUrl);

	const configuredNodeUrls = config.nodeList?.[networkIdentifier] ?? [];
	const configuredResolution = await findReachableNodeUrl(api, configuredNodeUrls);

	if (configuredResolution.nodeUrl)
		return configuredResolution.nodeUrl;

	const hasNodewatchUrl = !!config.nodewatchURL?.[networkIdentifier];
	let discoveryError = null;
	let nodeUrls = [];

	if (hasNodewatchUrl) {
		try {
			nodeUrls = await api.network.fetchNodeList(networkIdentifier);
		} catch (error) {
			discoveryError = error;
		}
	}

	const discoveredResolution = await findReachableNodeUrl(api, nodeUrls);

	if (discoveredResolution.nodeUrl)
		return discoveredResolution.nodeUrl;

	const attemptedNodeUrls = [...configuredNodeUrls, ...nodeUrls].map(normalizeNodeUrl);
	const lastError = discoveredResolution.lastError ?? discoveryError ?? configuredResolution.lastError;
	const lastErrorMessage = lastError?.message ? ` Last error: ${lastError.message}` : '';

	if (!attemptedNodeUrls.length) {
		throw new Error(`No node URL was provided and no built-in or nodewatch nodes were available for ${networkIdentifier}. `
			+ 'Pass --node-url explicitly or configure the NEM_NODEWATCH_* environment variables.');
	}

	throw new Error(`No reachable nodes were found for ${networkIdentifier}. Attempted: ${attemptedNodeUrls.join(', ')}.`
		+ lastErrorMessage);
};

/**
 * Creates the runtime used by each CLI command.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command runtime.
 */
const createRuntime = async options => {
	const apiConfig = createApiConfig();
	const api = new Api({
		config: apiConfig,
		makeRequest
	});
	const networkIdentifier = parseNetworkIdentifier(options.network);
	const walletDataPath = options['wallet-data'] ?? DEFAULT_WALLET_DATA_PATH;
	const walletEntries = await loadWalletEntries(walletDataPath);
	const walletIndex = parsePositiveInteger(options.index, 'index', 0);
	const walletEntry = resolveWalletEntry(walletEntries, networkIdentifier, walletIndex);
	const nodeUrl = await resolveNodeUrl(api, apiConfig, networkIdentifier, options['node-url']);
	const networkProperties = await api.network.fetchNetworkInfo(nodeUrl);

	if (networkProperties.networkIdentifier !== networkIdentifier) {
		throw new Error(`Node ${nodeUrl} belongs to ${networkProperties.networkIdentifier}, `
			+ `but the selected fixture is ${networkIdentifier}`);
	}

	const transferModule = createTransferModuleHarness(api, networkProperties, walletEntry);

	return {
		api,
		networkIdentifier,
		networkProperties,
		nodeUrl,
		transferModule,
		walletEntry,
		walletEntries,
		walletDataPath
	};
};

const createTransactionSearchCriteria = options => {
	const direction = parseDirection(options.direction);
	const searchCriteria = {
		group: parseTransactionGroup(options.group),
		pageNumber: parsePositiveInteger(options['page-number'], 'page-number', DEFAULT_PAGE_NUMBER),
		pageSize: parsePositiveInteger(options['page-size'], 'page-size', DEFAULT_PAGE_SIZE)
	};

	if (direction !== Direction.ALL)
		searchCriteria.filter = { direction };

	return searchCriteria;
};

const createBaseOutput = runtime => ({
	networkIdentifier: runtime.networkIdentifier,
	networkProperties: runtime.networkProperties,
	nodeUrl: runtime.nodeUrl,
	transferModuleReady: runtime.transferModule.constructor.name === TransferModule.name,
	walletAccount: runtime.walletEntry.walletAccount,
	walletDataPath: String(runtime.walletDataPath)
});

const runAccountInfoCommand = async runtime => {
	const { address } = runtime.walletEntry.walletAccount;
	const accountInfo = await runtime.api.account.fetchAccountInfo(runtime.networkProperties, address);

	return {
		...createBaseOutput(runtime),
		accountInfo
	};
};

const runTransactionsCommand = async (runtime, options) => {
	const searchCriteria = createTransactionSearchCriteria(options);
	const transactions = await runtime.api.transaction.fetchAccountTransactions(
		runtime.networkProperties,
		runtime.walletEntry.walletAccount,
		searchCriteria
	);

	return {
		...createBaseOutput(runtime),
		searchCriteria,
		transactions
	};
};

const runOverviewCommand = async (runtime, options) => {
	const [{ address }, transactionsPayload] = await Promise.all([
		Promise.resolve(runtime.walletEntry.walletAccount),
		runTransactionsCommand(runtime, options)
	]);
	const accountInfo = await runtime.api.account.fetchAccountInfo(runtime.networkProperties, address);

	return {
		...transactionsPayload,
		accountInfo
	};
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const findTransactionByHash = (transactions, hash) =>
	transactions.find(transaction => transaction.hash?.toLowerCase() === hash.toLowerCase()) ?? null;

/**
 * Polls confirmed + unconfirmed history for a transaction hash.
 * @param {object} runtime - The command runtime.
 * @param {object} account - The account to poll.
 * @param {string} hash - The transaction hash to find.
 * @param {{ attempts?: number, intervalMs?: number }} [pollOptions] - Polling options.
 * @returns {Promise<object>} The verification result.
 */
const pollForTransaction = async (runtime, account, hash, pollOptions = {}) => {
	const { attempts = 12, intervalMs = 15000 } = pollOptions;
	let sawUnconfirmed = false;

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const fetchHistory = searchCriteria =>
			runtime.api.transaction.fetchAccountTransactions(runtime.networkProperties, account, searchCriteria);
		const [unconfirmed, confirmed] = await Promise.all([
			fetchHistory({ group: TransactionGroup.UNCONFIRMED }),
			fetchHistory({ group: TransactionGroup.CONFIRMED, pageSize: 25 })
		]);
		const confirmedMatch = findTransactionByHash(confirmed, hash);

		if (confirmedMatch)
			return { status: 'confirmed', attempt, sawUnconfirmed, transaction: confirmedMatch };

		if (findTransactionByHash(unconfirmed, hash))
			sawUnconfirmed = true;

		await sleep(intervalMs);
	}

	return { status: 'timeout', sawUnconfirmed };
};

/**
 * Builds, fees, signs, announces and (optionally) verifies a transfer.
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runSendTransferCommand = async (runtime, options) => {
	const recipientAddress = options.to;

	if (!recipientAddress)
		throw new Error('send-transfer requires --to <address>');

	const amount = String(options.amount ?? '1');
	const feeTier = String(options['fee-tier'] ?? 'medium');
	const message = options.message ? String(options.message) : undefined;
	const senderAccount = runtime.walletEntry.walletAccount;
	const { id, divisibility } = runtime.networkProperties.networkCurrency;
	const nativeToken = { id, amount, divisibility };

	// 1. Build the draft bundle (fee defaults to 0).
	const draftBundle = await runtime.transferModule.createTransaction({ recipientAddress, tokens: [nativeToken], messageText: message, isMessageEncrypted: !!options.encrypt });

	// 2. Calculate the deterministic fee tiers and 3. apply the chosen tier before signing.
	const feeTiers = await runtime.transferModule.calculateTransactionFees(draftBundle);
	draftBundle.transactions.forEach((transaction, index) => {
		transaction.fee = feeTiers[index][feeTier];
	});

	// 4. Sign and 5. announce.
	const signedBundle = signTransactionBundle(runtime.networkIdentifier, draftBundle, runtime.walletEntry.privateKey);

	if (options['dry-run']) {
		return {
			...createBaseOutput(runtime),
			draftTransactions: draftBundle.transactions,
			appliedFees: feeTiers.map(tier => tier[feeTier]),
			signedTransactions: signedBundle.transactions.map(transaction => ({
				hash: transaction.hash,
				data: transaction.dto.data,
				signature: transaction.dto.signature
			}))
		};
	}

	const announceResult = await runtime.api.transaction.announceTransactionBundle(runtime.networkProperties, signedBundle);
	const hashes = signedBundle.transactions.map(transaction => transaction.hash);

	const result = {
		...createBaseOutput(runtime),
		sent: { recipientAddress, amount, feeTier, message: message ?? null },
		appliedFees: feeTiers.map(tier => tier[feeTier]),
		hashes,
		announceResult
	};

	if (options.wait)
		result.verification = await pollForTransaction(runtime, senderAccount, hashes[0]);

	return result;
};

const safeCall = async fn => {
	try {
		return { ok: true, value: await fn() };
	} catch (error) {
		return { ok: false, error: error.message, statusCode: error.statusCode ?? null };
	}
};

/**
 * Exercises the secondary read-only API services and reports each result.
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The per-service results.
 */
const runServicesCommand = async (runtime, options) => {
	const { networkProperties, networkIdentifier } = runtime;
	const account = runtime.walletEntry.walletAccount;
	const mosaicId = String(options.mosaic ?? 'company.token');
	const namespaceId = String(options.namespace ?? 'company');
	const namespaceOwner = options['ns-owner'] ? String(options['ns-owner']) : account.address;
	const results = {};

	results['10-fetchAccountBalance'] = await safeCall(() =>
		runtime.api.account.fetchAccountBalance(networkProperties, account.address));
	results['14-fetchMosaicInfo'] = await safeCall(() =>
		runtime.api.mosaic.fetchMosaicInfo(networkProperties, mosaicId));
	results['14-fetchMosaicInfos'] = await safeCall(() =>
		runtime.api.mosaic.fetchMosaicInfos(networkProperties, ['nem.xem', mosaicId]));
	results['20-fetchAccountNamespaces'] = await safeCall(() =>
		runtime.api.namespace.fetchAccountNamespaces(networkProperties, namespaceOwner));
	results['21-fetchNamespaceInfo'] = await safeCall(() =>
		runtime.api.namespace.fetchNamespaceInfo(networkProperties, namespaceId));
	results['21-fetchNamespaceInfos'] = await safeCall(() =>
		runtime.api.namespace.fetchNamespaceInfos(networkProperties, [namespaceId, 'nem']));
	results['22-fetchPrices'] = await safeCall(() => runtime.api.market.fetchPrices());
	results['23-fetchNodeList'] = await safeCall(() =>
		runtime.api.network.fetchNodeList(networkIdentifier));

	if (options.hash) {
		const hash = String(options.hash);
		results['19-fetchTransactionStatus'] = await safeCall(() =>
			runtime.api.transaction.fetchTransactionStatus(networkProperties, hash));
		results['19-fetchAccountTransaction'] = await safeCall(() =>
			runtime.api.transaction.fetchAccountTransaction(networkProperties, account, hash));
	}

	return { ...createBaseOutput(runtime), results };
};

/**
 * Opens a Listener and records WebSocket events for a fixed window.
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The recorded listener events.
 */
const runListenCommand = async (runtime, options) => {
	const timeoutMs = parsePositiveInteger(options.timeout, 'timeout', 30000);
	const listener = runtime.api.listener.createListener(runtime.networkProperties, runtime.walletEntry.walletAccount.address);
	const events = [];
	let openHandshakeCompleted = false;

	await new Promise(resolve => {
		const timer = setTimeout(resolve, timeoutMs);

		listener.open(closeEvent => events.push({ event: 'unsolicited-close', closeEvent }))
			.then(() => {
				openHandshakeCompleted = true;
				events.push({ event: 'open' });
				listener.listenNewBlock(block => events.push({ event: 'block', height: block?.height ?? null }));
				listener.listenAddedTransactions(TransactionGroup.CONFIRMED, tx => events.push({ event: 'confirmed', hash: tx?.hash }));
				listener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, tx => events.push({ event: 'unconfirmed', hash: tx?.hash }));
			})
			.catch(error => {
				events.push({ event: 'error', message: error?.message ?? String(error) });
				clearTimeout(timer);
				resolve();
			});
	});

	listener.close();

	return { ...createBaseOutput(runtime), listenedMs: timeoutMs, openHandshakeCompleted, events };
};

/**
 * Polls a multisig account's unconfirmed pool for the inner hash of a pending multisig transaction.
 * @param {object} runtime - The command runtime.
 * @param {string} multisigAddress - The multisig account address.
 * @returns {Promise<string | null>} The inner transaction hash, or null if not found.
 */
const fetchPendingInnerHash = async (runtime, multisigAddress) => {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const response = await makeRequest(`${runtime.nodeUrl}/account/unconfirmedTransactions?address=${multisigAddress}`);
		const pending = (response.data || []).find(item => item.transaction?.type === TransactionType.MULTISIG);
		const innerHash = pending?.meta?.innerHash?.data ?? null;

		if (innerHash)
			return innerHash;

		await sleep(5000);
	}

	return null;
};

/**
 * Converts an account to multisig by adding cosignatories (#15).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runCreateMultisigCommand = async (runtime, options) => {
	const multisigIndex = parsePositiveInteger(options.index, 'index', 4);
	const cosignerIndexes = String(options.cosigners ?? '0,2').split(',').map(value =>
		parsePositiveInteger(value.trim(), 'cosigners', 0));
	const minApprovalDelta = parsePositiveInteger(options['min-approval-delta'], 'min-approval-delta', cosignerIndexes.length);
	const multisigEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, multisigIndex);
	const modifications = cosignerIndexes.map(cosignerIndex => ({
		modificationType: MultisigAccountModificationType.ADD_COSIGNATORY,
		cosignatoryPublicKey: resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, cosignerIndex).walletAccount.publicKey
	}));

	const transaction = {
		type: TransactionType.MULTISIG_ACCOUNT_MODIFICATION,
		signerPublicKey: multisigEntry.walletAccount.publicKey,
		modifications,
		minApprovalDelta,
		deadline: createDeadline(runtime.networkProperties.networkTime, MULTISIG_TRANSACTION_DEADLINE_HOURS)
	};
	transaction.fee = createTransactionFee(runtime.networkProperties, calculateTransactionFee(transaction, runtime.networkProperties));

	const signed = signTransaction(runtime.networkIdentifier, transaction, multisigEntry.privateKey);
	const announceResult = await runtime.api.transaction.announceTransaction(runtime.networkProperties, signed);
	const result = {
		...createBaseOutput(runtime),
		multisigAddress: multisigEntry.walletAccount.address,
		cosignerIndexes,
		minApprovalDelta,
		appliedFee: transaction.fee.token.amount,
		hash: signed.hash,
		announceResult
	};

	if (options.wait)
		result.verification = await pollForTransaction(runtime, multisigEntry.walletAccount, signed.hash);

	return result;
};

/**
 * Initiates a transfer from a multisig account, signed by one cosignatory (#17).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runMultisigTransferCommand = async (runtime, options) => {
	const recipientAddress = options.to;

	if (!recipientAddress)
		throw new Error('multisig-transfer requires --to <address>');

	const multisigIndex = parsePositiveInteger(options['multisig-index'], 'multisig-index', 4);
	const amount = String(options.amount ?? '1');
	const multisigEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, multisigIndex);
	const { id, divisibility } = runtime.networkProperties.networkCurrency;

	// Built via TransferModule (BUG-6 fix): the runtime account (--index) is the initiating cosignatory and
	// senderPublicKey is the multisig account, so the inner transfer is attributed to it while the cosignatory
	// signs the wrapper.
	const bundle = await runtime.transferModule.createTransaction({
		recipientAddress,
		tokens: [{ id, amount, divisibility }],
		senderPublicKey: multisigEntry.walletAccount.publicKey
	});
	const signedBundle = signTransactionBundle(runtime.networkIdentifier, bundle, runtime.walletEntry.privateKey);

	if (options['dry-run']) {
		return {
			...createBaseOutput(runtime),
			draftTransactions: bundle.transactions,
			signedData: signedBundle.transactions[0].dto.data
		};
	}

	const announceResult = await runtime.api.transaction.announceTransactionBundle(runtime.networkProperties, signedBundle);
	const innerHash = announceResult?.[0]?.innerTransactionHash?.data
		?? await fetchPendingInnerHash(runtime, multisigEntry.walletAccount.address);

	return {
		...createBaseOutput(runtime),
		multisigAddress: multisigEntry.walletAccount.address,
		initiator: runtime.walletEntry.walletAccount.address,
		innerSigner: bundle.transactions[0].innerTransaction.signerPublicKey,
		wrapperSigner: bundle.transactions[0].signerPublicKey,
		wrapperHash: signedBundle.transactions[0].hash,
		innerHash,
		announceResult
	};
};

/**
 * Changes the min approval of an existing multisig account, wrapped in a multisig transaction signed by one
 * cosignatory. Without the remaining cosignatures it stays pending and expires at the deadline.
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runMultisigModificationCommand = async (runtime, options) => {
	const multisigIndex = parsePositiveInteger(options['multisig-index'], 'multisig-index', 4);
	const minApprovalDelta = Number.parseInt(String(options['min-approval-delta'] ?? '-1'), 10);
	const deadlineHours = parsePositiveInteger(options['deadline-hours'], 'deadline-hours', MULTISIG_TRANSACTION_DEADLINE_HOURS);

	if (!Number.isInteger(minApprovalDelta))
		throw new Error('Option --min-approval-delta must be an integer');

	const { networkProperties } = runtime;
	const multisigEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, multisigIndex);
	const deadline = createDeadline(networkProperties.networkTime, deadlineHours);

	// The multisig account cannot sign itself: the modification is the inner transaction attributed to it,
	// and the initiating cosignatory (--index) signs the wrapper.
	const innerTransaction = {
		type: TransactionType.MULTISIG_ACCOUNT_MODIFICATION,
		signerPublicKey: multisigEntry.walletAccount.publicKey,
		publicKeyAdditions: [],
		publicKeyDeletions: [],
		minApprovalDelta,
		deadline
	};
	innerTransaction.fee = createTransactionFee(networkProperties, calculateTransactionFee(innerTransaction, networkProperties));

	const transaction = {
		type: TransactionType.MULTISIG,
		signerPublicKey: runtime.walletEntry.walletAccount.publicKey,
		innerTransaction,
		deadline
	};
	transaction.fee = createTransactionFee(networkProperties, calculateTransactionFee(transaction, networkProperties));

	const signed = signTransaction(runtime.networkIdentifier, transaction, runtime.walletEntry.privateKey);
	const result = {
		...createBaseOutput(runtime),
		multisigAddress: multisigEntry.walletAccount.address,
		initiator: runtime.walletEntry.walletAccount.address,
		minApprovalDelta,
		deadlineHours,
		innerFee: innerTransaction.fee.token.amount,
		wrapperFee: transaction.fee.token.amount,
		wrapperHash: signed.hash
	};

	if (options['dry-run'])
		return { ...result, signedData: signed.dto.data, signature: signed.dto.signature };

	const announceResult = await runtime.api.transaction.announceTransaction(networkProperties, signed);
	const innerHash = announceResult?.innerTransactionHash?.data
		?? await fetchPendingInnerHash(runtime, multisigEntry.walletAccount.address);

	return {
		...result,
		innerHash,
		announceResult
	};
};

/**
 * Cosigns a pending multisig transaction by its inner hash (#18).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runCosignCommand = async (runtime, options) => {
	if (!options.hash)
		throw new Error('cosign requires --hash <innerTransactionHash>');

	const cosignerIndex = parsePositiveInteger(options['cosigner-index'], 'cosigner-index', 2);
	const multisigIndex = parsePositiveInteger(options['multisig-index'], 'multisig-index', 4);
	const cosignerEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, cosignerIndex);
	const multisigEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, multisigIndex);
	const multisigAddress = options['multisig-address'] ? String(options['multisig-address']) : multisigEntry.walletAccount.address;
	const innerHash = String(options.hash);

	const cosigned = cosignTransaction({
		networkIdentifier: runtime.networkIdentifier,
		hash: innerHash,
		multisigAccountAddress: multisigAddress,
		networkTime: runtime.networkProperties.networkTime
	}, cosignerEntry.privateKey);
	const announceResult = await runtime.api.transaction.announceTransaction(runtime.networkProperties, cosigned);

	return {
		...createBaseOutput(runtime),
		cosigner: cosignerEntry.walletAccount.address,
		multisigAddress,
		innerHash,
		cosignHash: cosigned.hash,
		announceResult
	};
};

/**
 * Computes + applies the tx fee, signs with the signer, announces, and optionally polls for confirmation.
 * @param {object} runtime - The command runtime.
 * @param {object} transaction - The wallet transaction object (without the tx fee).
 * @param {object} signerEntry - The wallet entry that signs the transaction.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const buildSignAnnounce = async (runtime, transaction, signerEntry, options) => {
	transaction.fee = createTransactionFee(runtime.networkProperties, calculateTransactionFee(transaction, runtime.networkProperties));
	const signed = signTransaction(runtime.networkIdentifier, transaction, signerEntry.privateKey);
	const announceResult = await runtime.api.transaction.announceTransaction(runtime.networkProperties, signed);
	const result = {
		...createBaseOutput(runtime),
		transactionType: transaction.type,
		appliedFee: transaction.fee.token.amount,
		hash: signed.hash,
		announceResult
	};

	if (options.wait)
		result.verification = await pollForTransaction(runtime, signerEntry.walletAccount, signed.hash);

	return result;
};

/**
 * Account key link / importance transfer (#25).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runAccountKeyLinkCommand = async (runtime, options) => {
	const signerEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, parsePositiveInteger(options.index, 'index', 0));
	const linkAction = String(options['link-action'] ?? 'activate') === 'deactivate' ? LinkAction.Unlink : LinkAction.Link;
	const remotePublicKey = options['remote-public-key'] ? String(options['remote-public-key']) : generateKeyPair().publicKey;
	const transaction = {
		type: TransactionType.ACCOUNT_KEY_LINK,
		signerPublicKey: signerEntry.walletAccount.publicKey,
		linkAction,
		remotePublicKey,
		deadline: createDeadline(runtime.networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS)
	};

	return { ...(await buildSignAnnounce(runtime, transaction, signerEntry, options)), linkAction, remotePublicKey };
};

/**
 * Namespace registration / provision (#26).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runRegisterNamespaceCommand = async (runtime, options) => {
	if (!options.name)
		throw new Error('register-namespace requires --name <namespace>');

	const signerEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, parsePositiveInteger(options.index, 'index', 0));
	const parentName = options.parent ? String(options.parent) : null;
	const rentalAmount = parentName ? '10' : '100';
	const transaction = {
		type: TransactionType.NAMESPACE_REGISTRATION,
		signerPublicKey: signerEntry.walletAccount.publicKey,
		namespaceName: String(options.name),
		parentName,
		rentalFeeSink: FEE_SINK.namespace[runtime.networkIdentifier],
		rentalFee: createTransactionFee(runtime.networkProperties, rentalAmount),
		deadline: createDeadline(runtime.networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS)
	};

	return { ...(await buildSignAnnounce(runtime, transaction, signerEntry, options)), namespaceName: String(options.name), parentName, rentalFee: rentalAmount };
};

/**
 * Mosaic definition (#27).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runMosaicDefinitionCommand = async (runtime, options) => {
	if (!options['mosaic-id'])
		throw new Error('mosaic-definition requires --mosaic-id <namespace.name>');

	const signerEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, parsePositiveInteger(options.index, 'index', 0));
	const transaction = {
		type: TransactionType.MOSAIC_DEFINITION,
		signerPublicKey: signerEntry.walletAccount.publicKey,
		mosaicDefinition: {
			id: String(options['mosaic-id']),
			description: 'claude test mosaic',
			properties: {
				divisibility: parsePositiveInteger(options.divisibility, 'divisibility', 0),
				initialSupply: parsePositiveInteger(options.supply, 'supply', 1000),
				supplyMutable: true,
				transferable: true
			}
		},
		rentalFeeSink: FEE_SINK.mosaic[runtime.networkIdentifier],
		rentalFee: createTransactionFee(runtime.networkProperties, '10'),
		deadline: createDeadline(runtime.networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS)
	};

	return { ...(await buildSignAnnounce(runtime, transaction, signerEntry, options)), mosaicId: String(options['mosaic-id']) };
};

/**
 * Mosaic supply change (#28).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runMosaicSupplyChangeCommand = async (runtime, options) => {
	if (!options['mosaic-id'])
		throw new Error('mosaic-supply-change requires --mosaic-id <namespace.name>');

	const signerEntry = resolveWalletEntry(runtime.walletEntries, runtime.networkIdentifier, parsePositiveInteger(options.index, 'index', 0));
	const action = String(options.action ?? 'increase') === 'decrease' ? MosaicSupplyChangeAction.DECREASE : MosaicSupplyChangeAction.INCREASE;
	const delta = parsePositiveInteger(options.delta, 'delta', 500);
	const transaction = {
		type: TransactionType.MOSAIC_SUPPLY_CHANGE,
		signerPublicKey: signerEntry.walletAccount.publicKey,
		mosaicId: String(options['mosaic-id']),
		action,
		delta,
		deadline: createDeadline(runtime.networkProperties.networkTime, SINGLE_TRANSACTION_DEADLINE_HOURS)
	};

	return { ...(await buildSignAnnounce(runtime, transaction, signerEntry, options)), mosaicId: String(options['mosaic-id']), action, delta };
};

/**
 * Fetches a transaction by hash and decrypts its message via the TransferModule (#12 verify).
 * @param {object} runtime - The command runtime.
 * @param {Record<string, string | boolean>} options - The CLI options.
 * @returns {Promise<object>} The command result.
 */
const runDecryptMessageCommand = async (runtime, options) => {
	if (!options.hash)
		throw new Error('decrypt-message requires --hash <transactionHash>');

	const transaction = await runtime.api.transaction.fetchAccountTransaction(
		runtime.networkProperties,
		runtime.walletEntry.walletAccount,
		String(options.hash)
	);
	const decryptedText = await runtime.transferModule.getDecryptedMessageText(transaction);

	return {
		...createBaseOutput(runtime),
		hash: String(options.hash),
		account: runtime.walletEntry.walletAccount.address,
		message: transaction.message,
		decryptedText
	};
};

const runCommand = async (command, options) => {
	if (command === Command.SEND_TRANSFER) {
		const runtime = await createRuntime(options);

		return runSendTransferCommand(runtime, options);
	}

	if (command === Command.SERVICES) {
		const runtime = await createRuntime(options);

		return runServicesCommand(runtime, options);
	}

	if (command === Command.LISTEN) {
		const runtime = await createRuntime(options);

		return runListenCommand(runtime, options);
	}

	if (command === Command.CREATE_MULTISIG) {
		const runtime = await createRuntime(options);

		return runCreateMultisigCommand(runtime, options);
	}

	if (command === Command.MULTISIG_MODIFICATION) {
		const runtime = await createRuntime(options);

		return runMultisigModificationCommand(runtime, options);
	}

	if (command === Command.MULTISIG_TRANSFER) {
		const runtime = await createRuntime(options);

		return runMultisigTransferCommand(runtime, options);
	}

	if (command === Command.COSIGN) {
		const runtime = await createRuntime(options);

		return runCosignCommand(runtime, options);
	}

	if (command === Command.DECRYPT_MESSAGE) {
		const runtime = await createRuntime(options);

		return runDecryptMessageCommand(runtime, options);
	}

	if (command === Command.ACCOUNT_KEY_LINK) {
		const runtime = await createRuntime(options);

		return runAccountKeyLinkCommand(runtime, options);
	}

	if (command === Command.REGISTER_NAMESPACE) {
		const runtime = await createRuntime(options);

		return runRegisterNamespaceCommand(runtime, options);
	}

	if (command === Command.MOSAIC_DEFINITION) {
		const runtime = await createRuntime(options);

		return runMosaicDefinitionCommand(runtime, options);
	}

	if (command === Command.MOSAIC_SUPPLY_CHANGE) {
		const runtime = await createRuntime(options);

		return runMosaicSupplyChangeCommand(runtime, options);
	}

	if (command === Command.ACCOUNT_INFO) {
		const runtime = await createRuntime(options);

		return runAccountInfoCommand(runtime);
	}

	if (command === Command.TRANSACTIONS) {
		const runtime = await createRuntime(options);

		return runTransactionsCommand(runtime, options);
	}

	if (command === Command.OVERVIEW) {
		const runtime = await createRuntime(options);

		return runOverviewCommand(runtime, options);
	}

	throw new Error(`Unsupported command "${command}". Run with --help to see the available commands.`);
};

const formatError = error => {
	const statusCode = error?.statusCode ? ` (status ${error.statusCode})` : '';
	const stack = error?.stack ? `\n${error.stack}` : '';

	return `${error.message}${statusCode}${stack}`;
};

/**
 * Runs the CLI.
 * @returns {Promise<void>} A promise that resolves when the CLI completes.
 */
const main = async () => {
	const { command, options } = parseArguments(process.argv.slice(2));

	if (options.help) {
		writeStdout(HELP_TEXT);

		return;
	}

	const result = await runCommand(command, options);
	writeStdout(JSON.stringify(result, null, 2));
};

main().catch(error => {
	writeStderr(formatError(error));
	process.exitCode = 1;
});
