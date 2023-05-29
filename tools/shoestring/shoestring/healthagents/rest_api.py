from symbollightapi.connector.SymbolConnector import SymbolConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

from shoestring.internal.NodeFeatures import NodeFeatures

NAME = 'REST API'


def should_run(node_config):
	return NodeFeatures.API in node_config.features


async def validate(context):
	endpoint = context.rest_endpoint
	connector = SymbolConnector(endpoint)

	try:
		chain_statistics = await connector.chain_statistics()
		log.info(f'REST API accessible, height = {chain_statistics.height}')
	except NodeException:
		log.error(f'cannot access REST API at {endpoint}')
