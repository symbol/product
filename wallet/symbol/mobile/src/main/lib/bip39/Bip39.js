import * as bip39 from 'bip39';

export class Bip39 {
	static WORDLIST = bip39.wordlists['english'];
	static validateMnemonic(mnemonic) {
		return bip39.validateMnemonic(mnemonic, Bip39.WORDLIST);
	}
} 
