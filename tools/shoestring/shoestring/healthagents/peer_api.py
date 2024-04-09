from symbollightapi.connector.SymbolPeerConnector import SymbolPeerConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

NAME = 'peer API'


def should_run(_):
	return True


async def validate(context):
	# this agent runs on the node (re)using the node's certificate (and identity key)
	# in order to prevent the connection from being rejected due to an 'in use identity key' error,
	# use 'localhost' so that the node treats the connection as local and allows the reuse of its identity key
	host = 'localhost'

	(_host, port) = context.peer_endpoint

	try:
		connector = SymbolPeerConnector(host, port, context.directories.certificates)
		chain_statistics = await connector.chain_statistics()
		log.info(_('health-peer-api-success').format(height=chain_statistics.height))
	except NodeException:
		log.error(_('health-peer-api-error').format(host=host, port=port))
