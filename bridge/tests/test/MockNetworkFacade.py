from symbolchain.nem.Network import Address as NemAddress
from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Address as SymbolAddress
from symbolchain.symbol.Network import Network as SymbolNetwork


class MockNemNetworkFacade:
	"""Mock NEM network facade."""

	def __init__(self):
		"""Creates a mock network facade."""

		self.network = NemNetwork.TESTNET

	@staticmethod
	def make_address(raw_address):
		return NemAddress(raw_address)


class MockSymbolNetworkFacade:
	"""Mock Symbol network facade."""

	def __init__(self):
		"""Creates a mock network facade."""

		self.network = SymbolNetwork.TESTNET

	@staticmethod
	def make_address(raw_address):
		return SymbolAddress(raw_address)
