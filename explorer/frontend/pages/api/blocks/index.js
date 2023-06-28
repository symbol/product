import { createPage, createSearchCriteria, getSearchCriteria } from '@/utils';
import { NextResponse } from 'next/server';
import symbolSDK from 'symbol-sdk';

const BASE_URL = 'http://192.168.51.192:3000';
const REST_URL = 'http://ec2-3-85-86-70.compute-1.amazonaws.com:4000'

export default async (req, res) => {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getBlockPage(req.query);

	res.status(200).json(data);
}

export const GET = async (req) => {
    const searchCriteria = getSearchCriteria(req);
    const data = await getBlockPage(searchCriteria);

    return NextResponse.json({ data });
}

export const fetchBlockPage = async (searchCriteria) => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`${BASE_URL}/api/blocks?${params}`);

	return response.json();
}

export const getBlockPage = async (searchCriteria) => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);

	const params = new URLSearchParams({
		limit: pageSize,
		offset: pageSize * pageNumber
	}).toString();

    const blocks = new Array(pageSize).fill(null).map((_, index) => {
		const transactionCount = Math.floor(Math.random() * 20 + 2);
		const timestamp = new Date(Date.now() - 15 * index * 1000).getTime();
		const transactionFees = new Array(transactionCount).fill(null).map(() => ({
			fee: Math.floor(Math.random() * 100 + 5) / 100,
			size: Math.floor(Math.random() * 300 + 100),
		}));

		const facade = new symbolSDK.facade.NemFacade('testnet');
		const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random())
		const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey)

		const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random())
		const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);
		const totalFee = + transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2);
		return {
			height: 3999820 - index - (pageNumber * pageSize),
			timestamp,
			harvester: address1.toString(),
			beneficiary: address2.toString(),
			transactionCount,
            statementCount: Math.floor(Math.random() * 10),
			size: 964,
			difficulty: 107.33,
			version: 1,
			hash: '019457123FD44E5F760314C88E8BCF54EC2436C6773E03C63D4645165BED4437',
			signature: 'e501a79f97bef4386e11e54dc52e297a180f9faece4bf0063798c56dc1e74bf1e210e31a6516cdd8e8e0cc91314502885e0f9943aa44ead26ab623bf1abafc02',
			totalFee,
			medianFee: + (totalFee / transactionFees.length).toFixed(2),
            reward: + transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2),
			transactionFees
		}
	});

	// await new Promise(resolve => setTimeout(resolve, 2000));

    return Promise.resolve(createPage(pageNumber === 10 ? [] : blocks, pageNumber));
}


export const getBlockInfo = async (height) => {
	const transactionCount = Math.floor(Math.random() * 20 + 2);
	const timestamp = new Date(Date.now() - 15 * 60000).getTime();
	const transactionFees = new Array(transactionCount).fill(null).map(() => ({
		fee: Math.floor(Math.random() * 100 + 5) / 100,
		size: Math.floor(Math.random() * 300 + 100),
	}));

	const facade = new symbolSDK.facade.NemFacade('testnet');
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random())
	const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey)

	const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random())
	const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey)

	const totalFee = + transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2);

	return {
		height,
		timestamp,
		harvester: address1.toString(),
		beneficiary: address2.toString(),
		transactionCount,
		statementCount: Math.floor(Math.random() * 10),
		size: 964,
		difficulty: 107.33,
		version: 1,
		hash: '019457123FD44E5F760314C88E8BCF54EC2436C6773E03C63D4645165BED4437',
		signature: 'e501a79f97bef4386e11e54dc52e297a180f9faece4bf0063798c56dc1e74bf1e210e31a6516cdd8e8e0cc91314502885e0f9943aa44ead26ab623bf1abafc02',
		totalFee,
		medianFee: + (totalFee / transactionFees.length).toFixed(2),
		reward: + transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2),
		transactionFees
	}
}


export const getNextBlock = async () => {
	const transactionCount = Math.floor(Math.random() * 20);
	const timestamp = new Date(Date.now() - 15 * 60000).getTime();
	const transactionFees = new Array(transactionCount).fill(null).map(() => ({
		fee: Math.floor(Math.random() * 100 + 5) / 100,
		size: Math.floor(Math.random() * 300 + 100),
	}));



	return {
		height,
		timestamp,
	}
}
