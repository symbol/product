import asyncio
import ssl
import tempfile
from collections import namedtuple
from pathlib import Path

import pytest
from symbolchain.BufferWriter import BufferWriter
from symbollightapi.model.PacketHeader import PacketHeader, PacketType

from shoestring.healthagents.peer_api import should_run, validate
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import ImportsConfiguration, NodeConfiguration, ShoestringConfiguration

from ..test.LogTestUtils import LogLevel, assert_max_log_level, assert_message_is_logged

# region (peer) server fixture


def _create_configuration():
	node_config = NodeConfiguration(NodeFeatures.PEER, None, None, None, None, 'CA CN', 'NODE CN')
	return ShoestringConfiguration('testnet', *(3 * [None]), ImportsConfiguration(None, None), node_config)


@pytest.fixture
async def server():
	async def handle_packet(reader, writer):
		try:
			header = await reader.readexactly(8)
			packet_header = PacketHeader.deserialize_from_buffer(header)

			if PacketType.CHAIN_STATISTICS != packet_header.packet_type:
				raise RuntimeError('unsupported packet type')

			response_header = PacketHeader(40, PacketType.CHAIN_STATISTICS)

			response_buffer_writer = BufferWriter()
			response_buffer_writer.write_int(1234, 8)
			response_buffer_writer.write_int(1111, 8)
			response_buffer_writer.write_int(888999, 8)
			response_buffer_writer.write_int(111222, 8)

			writer.write(response_header.serialize())
			writer.write(response_buffer_writer.buffer)
			await writer.drain()
		finally:
			writer.close()

	# generate server peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# create ssl context
			server_ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
			server_ssl_context.check_hostname = False
			server_ssl_context.verify_mode = ssl.CERT_NONE
			server_ssl_context.load_cert_chain(
				preparer.directories.certificates / 'node.full.crt.pem',
				keyfile=preparer.directories.certificates / 'node.key.pem')

			# start server
			server = await asyncio.start_server(  # pylint: disable=redefined-outer-name
				handle_packet,
				'127.0.0.1',
				8888,
				ssl=server_ssl_context)
			server.port = 8888
			yield server

			server.close()

# endregion


# pylint: disable=invalid-name


# region should_run

def test_should_run_for_all_roles():
	# Act + Assert:
	for features in (NodeFeatures.PEER, NodeFeatures.API, NodeFeatures.HARVESTER, NodeFeatures.VOTER):
		assert should_run(NodeConfiguration(features, *([None] * 6))), str(features)

# endregion


# region validate

async def _dispatch_validate(port, preparer):
	# Arrange:
	HealthAgentContext = namedtuple('HealthAgentContext', ['peer_endpoint', 'directories'])
	context = HealthAgentContext(('localhost', port), preparer.directories)

	# Act:
	await validate(context)


async def test_validate_passes_when_node_is_available(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# Act:
			await _dispatch_validate(server.port, preparer)

			# Assert:
			assert_message_is_logged('peer API accessible, height = 1234', caplog)
			assert_max_log_level(LogLevel.INFO, caplog)


async def test_validate_fails_when_node_is_offline(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange: use Preparer to generate requestor peer certificates
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration()) as preparer:
			preparer.create_subdirectories()
			preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)

			# Act:
			await _dispatch_validate(server.port + 1, preparer)

			# Assert:
			assert_message_is_logged(f'cannot access peer API at localhost on port {server.port + 1}', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)

# endregion
