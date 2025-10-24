from symbollightapi.connector.BasicConnector import BasicConnector


class VaultConnector(BasicConnector):
	"""Async connector for interacting with HashiCorp Vault."""

	def __init__(self, endpoint, access_token):
		"""Creates a HashiCorp Vault connector."""

		super().__init__(endpoint)

		self.access_token = access_token

	async def read_kv_secret_data(self, secret_name):
		"""Gets secret data stored in a kv secrets engine."""

		result_json = await self._dispatch(
			'get',
			f'v1/kv/data/{secret_name}',
			None,
			True,
			headers={'X-Vault-Token': self.access_token})

		return result_json['data']['data']
