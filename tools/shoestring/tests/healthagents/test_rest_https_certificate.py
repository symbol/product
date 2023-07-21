import asyncio
import os
import ssl
from collections import namedtuple

import pytest
from aiohttp import web

from shoestring.healthagents.rest_https_certificate import should_run, validate
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.internal.ShoestringConfiguration import NodeConfiguration

from ..test.LogTestUtils import LogLevel, assert_max_log_level, assert_message_is_logged

# region server (SSL) fixture


@pytest.fixture
async def server(aiohttp_server):
	app = web.Application()
	ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
	ssl_context.load_cert_chain(
		'./tests/resources/https_cert/localhost.crt',
		'./tests/resources/https_cert/localhost.key'
	)
	return await aiohttp_server(app, port=3001, ssl=ssl_context)

# endregion


# pylint: disable=invalid-name


# region should_run

def _create_node_configuration(api_https):
	return NodeConfiguration(None, None, None, None, api_https, None, None)


def test_should_run_for_https_role():
	# Act + Assert:
	assert should_run(_create_node_configuration(True))
	assert not should_run(_create_node_configuration(False))

# endregion


# region validate

def _validate_thread(context):
	asyncio.run(validate(context))


async def _dispatch_validate(test_args=None):
	HealthAgentContext = namedtuple('HealthAgentContext', ['hostname', 'test_args'])
	context = HealthAgentContext('localhost', test_args or [])

	await asyncio.get_running_loop().run_in_executor(None, _validate_thread, context)


async def test_validate_fails_when_certificate_is_self_signed(server, caplog):  # pylint: disable=redefined-outer-name, unused-argument
	# Arrange:
	error_message = 'HTTPS certificate looks invalid: verify error:num=18:self-signed certificate'

	# normalize error message
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	if '1.1.1' in openssl_executor.version():
		error_message = error_message.replace('self-signed', 'self signed')

	# Act:
	await _dispatch_validate()

	# Assert:
	assert_message_is_logged(error_message, caplog)
	assert_max_log_level(LogLevel.WARNING, caplog)


async def test_validate_passes_when_certificate_is_valid(server, caplog):   # pylint: disable=redefined-outer-name, unused-argument
	# Act:
	await _dispatch_validate(['-CAfile', './tests/resources/https_cert/localhost.crt'])

	# Assert:
	assert_message_is_logged('HTTPS certificate looks ok: valid from 23-06-05 to 33-06-02', caplog)
	assert_max_log_level(LogLevel.INFO, caplog)

# endregion
