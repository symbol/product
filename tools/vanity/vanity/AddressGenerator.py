import os
import secrets
from threading import Lock, Thread

from mnemonic import Mnemonic
from symbolchain.Bip32 import Bip32


class AddressGenerator:
	"""Vanity address generator."""

	def __init__(self, facade, max_wallet_accounts, key_pair_acceptor):
		"""Creates a generator."""

		self.facade = facade
		self.max_wallet_accounts = max_wallet_accounts
		self.key_pair_acceptor = key_pair_acceptor

		self.lock = Lock()

	def match_all(self, matcher):
		"""Matches all patterns specified in the provided matcher."""

		threads = [Thread(target=self._match_all_thread, args=(matcher,)) for i in range(0, os.cpu_count())]

		for thread in threads:
			thread.start()

		for thread in threads:
			thread.join()

	def _match_all_thread(self, matcher):
		coin_id = 1 if 'testnet' == self.facade.network.name else self.facade.BIP32_COIN_ID
		bip32 = Bip32(self.facade.BIP32_CURVE_NAME)

		while True:
			entropy = secrets.token_bytes(32)
			mnemonic = Mnemonic(bip32.mnemonic_language).to_mnemonic(entropy)

			bip32_root_node = bip32.from_mnemonic(mnemonic, '')  # no password

			for account_index in range(0, self.max_wallet_accounts):
				private_key = bip32_root_node.derive_path({44, coin_id, account_index, 0, 0}).private_key
				key_pair = self.facade.KeyPair(private_key)

				with self.lock:
					match_result = matcher.accept(key_pair)

					if match_result[1]:
						self.key_pair_acceptor(mnemonic, key_pair)

					if matcher.is_complete:
						return
