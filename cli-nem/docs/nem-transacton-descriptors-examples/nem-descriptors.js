import { PrivateKey, PublicKey } from '../../src/index.js';
import {
	Address, NemFacade, descriptors, models
} from '../../src/nem/index.js';

const signAndPrint = (facade, transaction) => {
	console.log('created NEM transaction:');
	console.log(transaction.toString());

	const privateKey = new PrivateKey('EDB671EB741BD676969D8A035271D1EE5E75DF33278083D877F23615EB839FEC');
	const signature = facade.signTransaction(new facade.static.KeyPair(privateKey), transaction);

	const jsonPayload = facade.transactionFactory.static.attachSignature(transaction, signature);

	console.log('prepared NEM JSON payload:');
	console.log(jsonPayload);
	console.log('');
};

(() => {
	const rawDescriptor = {
		type: 'transfer_transaction_v1',
		signerPublicKey: 'A59277D56E9F4FA46854F5EFAAA253B09F8AE69A473565E01FD9E6A738E4AB74',
		fee: 0x186A0n,
		timestamp: 191205516,
		deadline: 191291916,
		recipientAddress: 'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
		amount: 5100000n,
		message: {
			messageType: 1,
			message: 'hello nem'
		}
	};

	console.log('*** EXAMPLE CONSTRUCTION FROM UNTYPED MAP ***');
	const facade = new NemFacade('testnet');
	const transaction = facade.transactionFactory.create(rawDescriptor);
	signAndPrint(facade, transaction);
})();

(() => {
	const typedDescriptor = new descriptors.TransferTransactionV1Descriptor(
		new Address('TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW'),
		new models.Amount(5100000n),
		new descriptors.MessageDescriptor(models.MessageType.PLAIN, 'hello nem')
	);

	console.log('*** EXAMPLE CONSTRUCTION FROM TYPED DESCRIPTOR OBJECT AND FACADE ***');
	const facade = new NemFacade('testnet');
	const transaction = facade.createTransactionFromTypedDescriptor(
		typedDescriptor,
		new PublicKey('A59277D56E9F4FA46854F5EFAAA253B09F8AE69A473565E01FD9E6A738E4AB74'),
		0x186A0n,
		60 * 60
	);
	signAndPrint(facade, transaction);
})();






////sign



#!/usr/bin/env node

//
// Shows how to create all transactions manually using TransactionFactory.
//

import { PrivateKey } from '../src/index.js';
import { NemFacade } from '../src/nem/index.js';
import { SymbolFacade } from '../src/symbol/index.js';
import yargs from 'yargs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

(() => {
	class TransactionSample {
		constructor(facade, commonFields) {
			this.facade = facade;
			this.commonFields = commonFields;

			const privateKey = new PrivateKey('11002233445566778899AABBCCDDEEFF11002233445566778899AABBCCDDEEFF');
			this.keyPair = new this.facade.static.KeyPair(privateKey);
		}

		processTransactionDescriptors(transactionDescriptors) {
			transactionDescriptors.forEach(descriptor => {
				this.setCommonFields(descriptor);
				const transaction = this.facade.transactionFactory.create(descriptor);
				this.signAndPrint(transaction);
			});
		}

		setCommonFields(descriptor) {
			Object.assign(descriptor, {
				signerPublicKey: this.keyPair.publicKey,
				...this.commonFields
			});
		}

		signAndPrint(transaction) {
			const signature = this.facade.signTransaction(this.keyPair, transaction);
			this.facade.transactionFactory.static.attachSignature(transaction, signature);

			console.log(`Hash: ${this.facade.hashTransaction(transaction)}`);
			console.log(transaction.toString());
			console.log('---- ---- ----');
		}
	}

	const runAllTests = (sample, factoryNames) => {
		let testsPending = 1;
		let totalDescriptorsCount = 0;

		const decrementTestsPending = () => {
			testsPending -= 1;
			if (0 === testsPending)
				console.log(`finished processing ${totalDescriptorsCount} descriptors`);
		};

		factoryNames.forEach(factoryName => {
			testsPending += 1;

			const filepath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'descriptors', `${factoryName}.js`);
			import(pathToFileURL(filepath).toString()).then(module => {
				const transactionDescriptors = module.default();
				sample.processTransactionDescriptors(transactionDescriptors);
				totalDescriptorsCount += transactionDescriptors.length;
			}).finally(() => {
				decrementTestsPending();
			});
		});

		decrementTestsPending();
	};

	const nemTransactionSample = new TransactionSample(new NemFacade('testnet'), {
		deadline: 12345
	});

	const symbolTransactionSample = new TransactionSample(new SymbolFacade('testnet'), {
		fee: 625n,
		deadline: 12345n
	});

	const args = yargs(process.argv.slice(2))
		.option('blockchain', {
			describe: 'blockchain to run examples against',
			choices: ['nem', 'symbol'],
			require: true
		})
		.parseSync();

	if ('nem' === args.blockchain) {
		runAllTests(nemTransactionSample, [
			'nem_account_key_link',
			'nem_mosaic',
			'nem_multisig_account',
			'nem_namespace',
			'nem_transfer'
		]);
	} else {
		runAllTests(symbolTransactionSample, [
			'symbol_alias',
			'symbol_key_link',
			'symbol_lock',
			'symbol_metadata',
			'symbol_mosaic',
			'symbol_namespace',
			'symbol_restriction_account',
			'symbol_restriction_mosaic',
			'symbol_transfer'
		]);
	}
})();
