import asyncio
import ssl
from binascii import unhexlify
from pathlib import Path

import pytest
from symbolchain.BufferWriter import BufferWriter
from symbolchain.CryptoTypes import Hash256, PublicKey

from puller.client.SymbolPeerClient import SymbolPeerClient
from puller.model.Endpoint import Endpoint
from puller.model.Exceptions import NodeException
from puller.model.NodeInfo import NodeInfo
from puller.model.PacketHeader import PacketHeader, PacketType

# region test data


NODE_INFO_1 = NodeInfo(
	104,
	Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
	PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'),
	None,
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


def load_ssl_context(cert_id):
	certificate_directory = locate_certificate_directory(cert_id)

	ssl_context = ssl.create_default_context()
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
				await asyncio.sleep(0.25)

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

	server = await asyncio.start_server(handle_packet, '127.0.0.1', 8888, ssl=load_ssl_context(1))  # pylint: disable=redefined-outer-name
	server.simulate_long_operation = False
	server.simulate_corrupt_packet = False
	server.simulate_corrupt_packet_type = False
	server.host = '127.0.0.1'
	server.port = 8888
	yield server

	server.close()

# endregion

# pylint: disable=invalid-name


# region error handling

async def test_can_handle_timeout(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_long_operation = True

	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))
	client.timeout_seconds = 0.1

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.chain_height()


async def test_can_handle_corrupt_packet(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_corrupt_packet = True

	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.chain_height()


async def test_can_handle_corrupt_packet_type(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.simulate_corrupt_packet_type = True

	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.chain_height()


async def test_can_handle_stopped_node():
	# Arrange:
	client = SymbolPeerClient('127.0.0.1', 8888, locate_certificate_directory(2))
	client.timeout_seconds = 0.1

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.chain_height()

# endregion


# region chain_height, chain_statistics, finalization_statistics

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act:
	height = await client.chain_height()

	# Assert:
	assert 1234 == height


async def test_can_query_chain_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act:
	chain_statistics = await client.chain_statistics()

	# Assert:
	assert 1234 == chain_statistics.height
	assert 888999 == chain_statistics.score_high
	assert 111222 == chain_statistics.score_low


async def test_can_query_finalization_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act:
	finalization_statistics = await client.finalization_statistics()

	# Assert:
	assert 222 == finalization_statistics.epoch
	assert 10 == finalization_statistics.point
	assert 1198 == finalization_statistics.height
	assert Hash256('C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043') == finalization_statistics.hash

# endregion


# region node_info, peers

async def test_can_query_node_info(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act:
	node_info = await client.node_info()

	# Assert:
	assert NODE_INFO_1 == node_info


async def test_can_query_peers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolPeerClient(server.host, server.port, locate_certificate_directory(2))

	# Act:
	peers = await client.peers()

	# Assert:
	assert [NODE_INFO_2, NODE_INFO_3] == peers

# endregion
