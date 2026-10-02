import asyncio
import ssl

from symbolchain.BufferReader import BufferReader
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.symbol.Network import NetworkTimestamp

from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from ..model.PacketHeader import PacketHeader, PacketType
from .BasicConnector import NodeException
from .CatapultCertificateProcessor import CatapultCertificateProcessor
from .SymbolConnector import ChainStatistics, FinalizationStatistics


class SymbolPeerConnector:
	"""Async connector for interacting with a Symbol peer node."""

	def __init__(self, host, port, certificate_directory):
		"""Creates a Symbol async (peer) connector."""

		(self.node_host, self.node_port) = (host, port)
		self.timeout_seconds = None
		self.node_public_key = None

		self.ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
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

	async def network_time(self):
		"""Gets network time."""

		return await self._send_socket_request(PacketType.NETWORK_TIME, self._parse_network_time)

	async def node_info(self):
		"""Gets node information."""

		node_info = await self._send_socket_request(PacketType.NODE_INFORMATION, self._parse_node_info_response)
		node_info.node_public_key = self.node_public_key
		return node_info

	async def peers(self):
		"""Gets peer nodes information."""

		return await self._send_socket_request(PacketType.PEERS, self._parse_peers_response)

	async def _send_socket_request(self, packet_type, parser):
		writer = None
		self.node_public_key = None
		certificate_processor = CatapultCertificateProcessor()
		try:
			reader, writer = await asyncio.open_connection(
				self.node_host,
				self.node_port,
				ssl=self.ssl_context,
				ssl_handshake_timeout=self.timeout_seconds)

			# Handshake succeeded; try Catapult-specific chain processing.
			ssl_object = writer.get_extra_info('ssl_object')
			self.node_public_key = self._try_populate_peer_public_key(ssl_object, certificate_processor)

			return await asyncio.wait_for(self._process_write_read(reader, writer, packet_type, parser), timeout=self.timeout_seconds)
		except (ConnectionRefusedError, OSError, ssl.SSLError, asyncio.exceptions.IncompleteReadError, asyncio.exceptions.TimeoutError) as ex:
			raise NodeException from ex
		finally:
			if writer:
				writer.close()
				await writer.wait_closed()

	@staticmethod
	def _try_get_peer_chain_as_der(ssl_object):
		if not ssl_object:
			return []

		for method_name in ('get_unverified_chain', 'get_verified_chain'):
			method = getattr(ssl_object, method_name, None)
			if not method:
				continue

			try:
				chain = method()
			except Exception:  # pylint: disable=broad-except
				continue

			if not chain:
				continue

			der_chain = []
			ssl_certificate_type = getattr(ssl, 'Certificate', None)
			ssl_der_encoding = getattr(ssl, 'DER', None)
			for item in chain:
				if isinstance(item, (bytes, bytearray)):
					der_chain.append(bytes(item))
				# pylint: disable-next=isinstance-second-argument-not-valid-type
				elif ssl_certificate_type is not None and ssl_der_encoding is not None and isinstance(item, ssl_certificate_type):
					# Python 3.10+: ssl.Certificate requires explicit DER format argument
					der_chain.append(item.public_bytes(ssl_der_encoding))
				elif hasattr(item, 'public_bytes'):
					try:
						der_chain.append(item.public_bytes())
					except TypeError:
						continue

			if der_chain:
				return der_chain

		leaf_der = ssl_object.getpeercert(binary_form=True)
		return [leaf_der] if leaf_der else []

	@staticmethod
	def _try_populate_peer_public_key(ssl_object, certificate_processor):
		"""Tries Catapult-style chain verification and extracts peer public key. Returns the public key or None."""
		try:
			chain_der = SymbolPeerConnector._try_get_peer_chain_as_der(ssl_object)
			if not chain_der or not certificate_processor:
				return None

			if certificate_processor.verify_der_chain(chain_der):
				return certificate_processor.certificate(certificate_processor.size - 1).public_key
			return certificate_processor.try_extract_public_key_from_der(chain_der[0])
		except Exception:  # pylint: disable=broad-except
			return None

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
	def _parse_network_time(reader):
		send_timestamp = reader.read_int(8)
		reader.read_int(8)  # receive_timestamp
		return NetworkTimestamp(send_timestamp)

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
			peers.append(SymbolPeerConnector._parse_node_info_response(reader))

		return peers
