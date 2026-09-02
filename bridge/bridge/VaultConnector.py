from symbollightapi.connector.BasicConnector import BasicConnector


class VaultConnector(BasicConnector):
	"""Async connector for interacting with HashiCorp Vault."""

	def __init__(self, endpoint, access_token):
		"""Creates a HashiCorp Vault connector."""

		super().__init__(endpoint)

		self.access_token = access_token

	async def _get_authenticated(self, url_path):
		"""Initiates an authenticated GET to the specified path."""

		return await self._dispatch('get', url_path, None, True, headers={'X-Vault-Token': self.access_token})

	async def read_health(self):
		"""Gets the health of the vault server. Raises NodeException unless it can serve the signing key."""

		return await self.get('v1/sys/health')

	async def read_token_ttl(self):
		"""Gets the seconds left before the access token expires, or None when it does not expire."""

		result_json = await self._get_authenticated('v1/auth/token/lookup-self')

		token = result_json['data']
		return token['ttl'] if token['expire_time'] else None

	async def read_kv_secret_data(self, secret_name):
		"""Gets secret data stored in a kv secrets engine."""

		result_json = await self._get_authenticated(f'v1/kv/data/{secret_name}')

		return result_json['data']['data']
