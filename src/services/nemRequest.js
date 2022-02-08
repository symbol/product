/*
 * (C) Symbol Contributors 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 *
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.NEM_ENDPOINT;

const client = axios.create({
	baseURL: endpoint
});

const NemRequest = {
	/**
	 * Gets account balance.
	 * @param {string} _address Account address.
	 * @returns {Promise<object>} Account balance.
	 */
	getAccountInfo: async _address => {
		console.log('endpoint :>> ', endpoint);

		try {
			const response = await client.get(`/account/get?address=${_address}`);

			return { response };
		} catch (error) {
			console.error(`Can't get address balance ${_address}`);
			return { error };
		}
	},

	/**
	 * Gets timestamp from network.
	 * @returns {Promise<object>} Timestamp.
	 */
	getNetworkTime: async () => {
		try {
			const response = await client.get('/time-sync/network-time');
			return { response };
		} catch (error) {
			console.error('Can not get network time.');
			return { error };
		}
	},

	/**
	 * Gets unconfirmed transactions from account.
	 * @param {string} _address Account address.
	 * @returns {Promise<Array>} Transactions.
	 */
	getUnconfirmedTransactions: async _address => {
		try {
			const response = await client.get(`/account/unconfirmedTransactions?address=${_address}`);
			return { response };
		} catch (error) {
			console.error(`Can't get address unconfirmed transactions`);
			return { error };
		}
	},

	/**
	 * Announce payload to the network.
	 * @param {string} payload - Signed transaction payload.
	 * @returns {object} Announce transaction status.
	 */
	announceTransaction: async payload => {
		try {
			const response = await client.post('/transaction/announce', payload);
			return { response };
		} catch (error) {
			console.error(`Can't announce transaction ${payload}`);
			return { error };
		}
	}
};

export default NemRequest;
