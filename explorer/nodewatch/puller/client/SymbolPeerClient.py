import asyncio
import ssl

from symbolchain.BufferReader import BufferReader
from symbolchain.CryptoTypes import Hash256, PublicKey

from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from ..model.PacketHeader import PacketHeader, PacketType
from .BasicClient import NodeException
from .SymbolClient import ChainStatistics, FinalizationStatistics


class SymbolPeerClient:
	"""Async client for connecting to a Symbol peer node."""

	def __init__(self, host, port, certificate_directory):
		"""Creates a Symbol async (peer) client."""

		(self.node_host, self.node_port) = (host, port)
		self.timeout_seconds = None

		self.ssl_context = ssl.create_default_context()
		self.ssl_context.check_hostname = False
		self.ssl_context.verify_mode = ssl.CERT_NONE
		self.ssl_context.load_cert_chain(
			certificate_directory / 'node.full.crt.pem',
			keyfile=certificate_directory / 'node.key.pem')

	async def chain_height(self):
		"""Gets chain height."""

		return (await self.chain_statistics()).height

	async def chain_statistics(self):
		"""Gets chain statistics."""

		return await self._send_socket_request(PacketType.CHAIN_STATISTICS, self._parse_chain_statistics_response)

	async def finalization_statistics(self):
		"""Gets finalization statistics."""

		return await self._send_socket_request(PacketType.FINALIZATION_STATISTICS, self._parse_finalization_statistics_response)

	async def node_info(self):
		"""Gets node information."""

		return await self._send_socket_request(PacketType.NODE_INFORMATION, self._parse_node_info_response)

	async def peers(self):
		"""Gets peer nodes information."""

		return await self._send_socket_request(PacketType.PEERS, self._parse_peers_response)

	async def _send_socket_request(self, packet_type, parser):
		writer = None
		try:
			reader, writer = await asyncio.open_connection(
				self.node_host,
				self.node_port,
				ssl=self.ssl_context,
				ssl_handshake_timeout=self.timeout_seconds)
			return await asyncio.wait_for(self._process_write_read(reader, writer, packet_type, parser), timeout=self.timeout_seconds)
		except (ConnectionRefusedError, asyncio.exceptions.IncompleteReadError, asyncio.exceptions.TimeoutError) as ex:
			raise NodeException from ex
		finally:
			if writer:
				writer.close()

	@staticmethod
	async def _process_write_read(reader, writer, packet_type, parser):
		writer.write(PacketHeader(packet_type=packet_type).serialize())
		await writer.drain()

		header_buffer = await reader.readexactly(8)
		packet_header = PacketHeader.deserialize_from_buffer(header_buffer, packet_type)
		body_buffer = await reader.readexactly(packet_header.size - 8)

		return parser(BufferReader(body_buffer))

	@staticmethod
	def _parse_chain_statistics_response(reader):
		height = reader.read_int(8)
		reader.read_int(8)  # finalized_height
		score_high = reader.read_int(8)
		score_low = reader.read_int(8)
		return ChainStatistics(height, score_high, score_low)

	@staticmethod
	def _parse_finalization_statistics_response(reader):
		epoch = reader.read_int(4)
		point = reader.read_int(4)
		height = reader.read_int(8)
		finalization_hash = Hash256(reader.read_bytes(32))
		return FinalizationStatistics(epoch, point, height, finalization_hash)

	@staticmethod
	def _parse_node_info_response(reader):
		reader.read_int(4)  # size
		version = reader.read_int(4)
		main_public_key = PublicKey(reader.read_bytes(32))
		network_generation_hash_seed = Hash256(reader.read_bytes(32))
		roles = reader.read_int(4)
		port = reader.read_int(2)
		network_identifier = reader.read_int(1)

		host_size = reader.read_int(1)
		name_size = reader.read_int(1)
		host = reader.read_bytes(host_size).decode('utf8')
		name = reader.read_bytes(name_size).decode('utf8')

		return NodeInfo(
			network_identifier,
			network_generation_hash_seed,
			main_public_key,
			None,
			Endpoint('http', host, port),
			name,
			version,
			roles)

	@staticmethod
	def _parse_peers_response(reader):
		peers = []
		while not reader.eof:
			peers.append(SymbolPeerClient._parse_node_info_response(reader))

		return peers
