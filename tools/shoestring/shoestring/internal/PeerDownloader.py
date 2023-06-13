import json
import random

from zenlog import log

from .NodeDownloader import NodeDownloader

# region download_peers


def _save_peers_file(nodes, directory, name):
	nodes.sort(key=lambda node: node['publicKey'])
	filepath = directory / f'peers-{name}.json'
	with open(filepath, 'wt', encoding='utf8') as outfile:
		json.dump({
			'knownPeers': nodes,
			'_info': f'this file contains a list of {name} peers and can be shared',
		}, outfile, indent=2)

	log.info(_('peer-downloader-saved-file').format(filepath=filepath))


async def download_peers(nodewatch_endpoint, resources_directory, save_api_nodes=False, min_balance=0):
	"""Downloads and generates all required peer files."""

	downloader = NodeDownloader(nodewatch_endpoint)
	downloader.max_output_nodes = 20
	downloader.min_balance = min_balance

	await downloader.download_peer_nodes()
	_save_peers_file(downloader.select_peer_nodes(), resources_directory, 'p2p')

	if save_api_nodes:
		await downloader.download_api_nodes()
		_save_peers_file(downloader.select_api_nodes(), resources_directory, 'api')

	return downloader.select_api_endpoints()

# endregion


# region load_api_endpoints

def _is_api_node(node_json):
	roles = node_json['metadata']['roles'].split(',')
	return 'Api' in roles


def _extract_api_endpoint(node_json):
	endpoint_json = node_json['endpoint']
	port = int(endpoint_json['api_port'] if 'api_port' in endpoint_json else 3000)
	return f'http://{endpoint_json["host"]}:{port}'


def load_api_endpoints(resources_directory):
	"""Loads api endpoints from peers files."""

	api_endpoints = set()
	for name in ('p2p', 'api'):
		peers_filepath = resources_directory / f'peers-{name}.json'
		if not peers_filepath.exists():
			continue

		log.info(_('peer-downloader-loading-api-endpoints').format(filepath=peers_filepath))
		with open(peers_filepath, 'rt', encoding='utf8') as infile:
			peers_json = json.loads(infile.read())
			api_endpoints.update([_extract_api_endpoint(node_json) for node_json in peers_json['knownPeers'] if _is_api_node(node_json)])

	api_endpoints = [*api_endpoints]
	random.shuffle(api_endpoints)
	return api_endpoints

# endregion
