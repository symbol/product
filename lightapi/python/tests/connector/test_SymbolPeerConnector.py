import asyncio
import ssl
from binascii import unhexlify
from pathlib import Path

import pytest
from symbolchain.BufferWriter import BufferWriter
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.symbol.Network import NetworkTimestamp

from symbollightapi.connector.SymbolPeerConnector import SymbolPeerConnector
from symbollightapi.model.Endpoint import Endpoint
from symbollightapi.model.Exceptions import NodeException
from symbollightapi.model.NodeInfo import NodeInfo
from symbollightapi.model.PacketHeader import PacketHeader, PacketType

# region test data


NODE_INFO_1 = NodeInfo(
	104,
	Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
	PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'),
	PublicKey('1B1A4ABD2DD41ABE99DBC7728B89B06AE3EA609563AEF337C3042757F82D569F'),
	Endpoint('http', 'wolf.importance.jp', 7900),
	'The Wolf Farm owned by Tresto(@TrendStream)',
	16777988,
	3)


NODE_INFO_2 = NodeInfo(
	104,
	Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
	PublicKey('FB744B408D392E0F99701432E0BC8A0D38BEFDEA8019826CCE91458C6E734ADB'),
	None,
	Endpoint('http', 'xym619.allnodes.me', 7900),
	'Allnodes619',
	16777989,
	3)


NODE_INFO_3 = NodeInfo(
	104,
	Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
	PublicKey('C807BE28855D0C87A8A2C032E51790CCB9158C15CBACB8B222E27DFFFEB3697D'),
	None,
	Endpoint('http', 'tiger.catapult.ninja', 7900),
	'tiger',
	16777989,
	5)

# endregion


# region ssl helpers

def locate_certificate_directory(cert_id):
	return Path(f'tests/resources/cert{cert_id}').absolute()


def load_server_ssl_context(cert_id):
	certificate_directory = locate_certificate_directory(cert_id)

	ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
	ssl_context.check_hostname = False
	ssl_context.verify_mode = ssl.CERT_NONE
	ssl_context.load_cert_chain(
		certificate_directory / 'node.full.crt.pem',
		keyfile=certificate_directory / 'node.key.pem')
	return ssl_context

# endregion


# region server fixture

@pytest.fixture
async def server():  # pylint: disable=too-many-statements
	def serialize_node_info(writer, node_info):
		writer.write_int(81 + len(node_info.endpoint.host) + len(node_info.name), 4)
		writer.write_int(node_info.version, 4)
		writer.write_bytes(node_info.main_public_key.bytes)
		writer.write_bytes(node_info.network_generation_hash_seed.bytes)
		writer.write_int(node_info.roles, 4)
		writer.write_int(node_info.endpoint.port, 2)
		writer.write_int(node_info.network_identifier, 1)
		writer.write_int(len(node_info.endpoint.host), 1)
		writer.write_int(len(node_info.name), 1)
		writer.write_bytes(node_info.endpoint.host.encode('utf8'))
		writer.write_bytes(node_info.name.encode('utf8'))

	async def handle_packet(reader, writer):
		try:
			header = await reader.readexactly(8)
			packet_header = PacketHeader.deserialize_from_buffer(header)

			if server.simulate_long_operation:
				server.sleep_task = asyncio.create_task(asyncio.sleep(0.25))
				await server.sleep_task

			response_header = PacketHeader()
			response_buffer_writer = BufferWriter()
			if PacketType.CHAIN_STATISTICS == packet_header.packet_type:
				response_header = PacketHeader(40, PacketType.CHAIN_STATISTICS)

				response_buffer_writer.write_int(1234, 8)
				response_buffer_writer.write_int(0, 8)
				response_buffer_writer.write_int(888999, 8)
				response_buffer_writer.write_int(111222, 8)
			elif PacketType.FINALIZATION_STATISTICS == packet_header.packet_type:
				response_header = PacketHeader(56, PacketType.FINALIZATION_STATISTICS)

				response_buffer_writer.write_int(222, 4)
				response_buffer_writer.write_int(10, 4)
				response_buffer_writer.write_int(1198, 8)
				response_buffer_writer.write_bytes(unhexlify('C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043'))
			elif PacketType.NETWORK_TIME == packet_header.packet_type:
				response_header = PacketHeader(24, PacketType.NETWORK_TIME)

				response_buffer_writer.write_int(123456789, 8)
				response_buffer_writer.write_int(123457890, 8)
			elif PacketType.NODE_INFORMATION == packet_header.packet_type:
				serialize_node_info(response_buffer_writer, NODE_INFO_1)
				response_header = PacketHeader(8 + len(response_buffer_writer.buffer), PacketType.NODE_INFORMATION)
			elif PacketType.PEERS == packet_header.packet_type:
				serialize_node_info(response_buffer_writer, NODE_INFO_2)
				serialize_node_info(response_buffer_writer, NODE_INFO_3)
				response_header = PacketHeader(8 + len(response_buffer_writer.buffer), PacketType.PEERS)

			if server.simulate_corrupt_packet_type:
				response_header = PacketHeader(response_header.size, PacketType.UNDEFINED)

			if server.simulate_corrupt_packet:
				response_buffer_writer.buffer = response_buffer_writer.buffer[:-2]

			writer.write(response_header.serialize())
			writer.write(response_buffer_writer.buffer)
			await writer.drain()
		finally:
			writer.close()

	server_ssl_context = load_server_ssl_context(1)
	server = await asyncio.start_server(handle_packet, '127.0.0.1', 8888, ssl=server_ssl_context)  # pylint: disable=redefined-outer-name
	server.simulate_long_operation = False
	server.simulate_corrupt_packet = False
	server.simulate_corrupt_packet_type = False
	server.sleep_task = None
	server.host = '127.0.0.1'
	server.port = 8888
	yield server

	if server.sleep_task:
		server.sleep_task.cancel()

	server.close()

# endregion

# pylint: disable=invalid-name, protected-access


# region error handling

async def test_can_handle_timeout(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_long_operation = True

	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))
	connector.timeout_seconds = 0.1

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.chain_height()


async def test_can_handle_corrupt_packet(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_corrupt_packet = True

	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.chain_height()


async def test_can_handle_corrupt_packet_type(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_corrupt_packet_type = True

	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.chain_height()


async def _assert_can_handle_stopped_node(host):
	# Arrange:
	connector = SymbolPeerConnector(host, 8888, locate_certificate_directory(2))

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.chain_height()


async def test_can_handle_stopped_node():
	await _assert_can_handle_stopped_node('127.0.0.1')


async def test_can_handle_multiple_exceptions():
	# Act + Assert: 'localhost' will raise a wrapped exception composed of two exceptions (failure to reach 127.0.0.1 and ::1)
	await _assert_can_handle_stopped_node('localhost')

# endregion


# region chain_height, chain_statistics, finalization_statistics, network_time

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	height = await connector.chain_height()

	# Assert:
	assert 1234 == height


async def test_can_query_chain_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	chain_statistics = await connector.chain_statistics()

	# Assert:
	assert 1234 == chain_statistics.height
	assert 888999 == chain_statistics.score_high
	assert 111222 == chain_statistics.score_low


async def test_can_query_finalization_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	finalization_statistics = await connector.finalization_statistics()

	# Assert:
	assert 222 == finalization_statistics.epoch
	assert 10 == finalization_statistics.point
	assert 1198 == finalization_statistics.height
	assert Hash256('C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043') == finalization_statistics.hash


async def test_can_query_network_time(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	network_time = await connector.network_time()

	# Assert:
	assert NetworkTimestamp(123456789) == network_time  # send timestamp

# endregion


# region node_info, peers

async def test_can_query_node_info(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	node_info = await connector.node_info()

	# Assert:
	assert NODE_INFO_1 == node_info


async def test_can_query_peers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolPeerConnector(server.host, server.port, locate_certificate_directory(2))

	# Act:
	peers = await connector.peers()

	# Assert:
	assert [NODE_INFO_2, NODE_INFO_3] == peers

# endregion


# region _try_get_peer_chain_as_der

def test_try_get_peer_chain_as_der_prioritizes_unverified_chain():
	class CertificateObject:
		def __init__(self, payload):
			self.payload = payload

		def public_bytes(self):
			return self.payload

	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [CertificateObject(b'\xAA\xBB')]

		@staticmethod
		def get_verified_chain():
			raise RuntimeError('should not be called')

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xFF'

	assert [b'\xAA\xBB'] == SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())


def test_try_get_peer_chain_as_der_returns_verified_chain_when_unverified_fails():
	class CertificateObject:
		def __init__(self, payload):
			self.payload = payload

		def public_bytes(self):
			return self.payload

	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			raise RuntimeError('unverified chain unavailable')

		@staticmethod
		def get_verified_chain():
			return [CertificateObject(b'\xAA\xBB')]

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xFF'

	assert [b'\xAA\xBB'] == SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())


def test_try_get_peer_chain_as_der_ignores_items_with_incompatible_public_bytes_call():
	class InvalidCertificateObject:
		@staticmethod
		def public_bytes(encoding):
			return encoding

	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [InvalidCertificateObject()]

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xCC\xDD'

	assert [b'\xCC\xDD'] == SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())


def test_try_get_peer_chain_as_der_falls_back_to_peer_cert_when_chain_api_missing():
	class MockSslObject:
		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\x11\x22\x33'

	assert [b'\x11\x22\x33'] == SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())


def test_try_get_peer_chain_as_der_returns_empty_when_ssl_object_is_none():
	assert [] == SymbolPeerConnector._try_get_peer_chain_as_der(None)


def test_try_get_peer_chain_as_der_returns_bytes_items_directly():
	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [bytearray(b'\x44\x55')]

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\x00'

	result = SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())
	assert [b'\x44\x55'] == result
	assert isinstance(result[0], bytes)


def test_try_get_peer_chain_as_der_supports_ssl_certificate_items(monkeypatch):
	class FakeCertificate:
		def __init__(self, payload):
			self.payload = payload

		def public_bytes(self, encoding):
			assert 'der-encoding' == encoding
			return self.payload

	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [FakeCertificate(b'\x77\x88')]

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\x00'

	monkeypatch.setattr(ssl, 'Certificate', FakeCertificate, raising=False)
	monkeypatch.setattr(ssl, 'DER', 'der-encoding', raising=False)

	assert [b'\x77\x88'] == SymbolPeerConnector._try_get_peer_chain_as_der(MockSslObject())

# endregion


# region _try_populate_peer_public_key

def test_try_populate_peer_public_key_returns_none_when_chain_empty():
	# Act:
	result = SymbolPeerConnector._try_populate_peer_public_key(None, object())

	# Assert:
	assert result is None


def test_try_populate_peer_public_key_returns_key_on_verified_chain():
	class CertificateInfo:
		def __init__(self, public_key):
			self.public_key = public_key

	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [b'\xAB\xCD']

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xFF'

	class MockProcessor:
		size = 1

		@staticmethod
		def verify_der_chain(_chain_der):
			return True

		@staticmethod
		def certificate(_index):
			return CertificateInfo(PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'))

	# Act:
	result = SymbolPeerConnector._try_populate_peer_public_key(MockSslObject(), MockProcessor())

	# Assert:
	assert PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA') == result


def test_try_populate_peer_public_key_falls_back_to_leaf_extraction_on_verification_failure():
	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [b'\xAB\xCD']

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xFF'

	class MockProcessor:
		size = 1

		@staticmethod
		def verify_der_chain(_chain_der):
			return False

		@staticmethod
		def try_extract_public_key_from_der(certificate_der):
			if b'\xAB\xCD' == certificate_der:
				return PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA')
			return None

	# Act:
	result = SymbolPeerConnector._try_populate_peer_public_key(MockSslObject(), MockProcessor())

	# Assert:
	assert PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA') == result


def test_try_populate_peer_public_key_returns_none_on_internal_exception():
	class MockSslObject:
		@staticmethod
		def get_unverified_chain():
			return [b'\xAB\xCD']

		@staticmethod
		def get_verified_chain():
			return []

		@staticmethod
		def getpeercert(binary_form=True):
			assert binary_form
			return b'\xFF'

	class MockProcessor:
		@staticmethod
		def verify_der_chain(_chain_der):
			raise RuntimeError('forced failure')

	# Act:
	result = SymbolPeerConnector._try_populate_peer_public_key(MockSslObject(), MockProcessor())

	# Assert:
	assert result is None

# endregion
