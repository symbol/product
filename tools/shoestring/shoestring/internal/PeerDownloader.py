import json

from zenlog import log

from .NodeDownloader import NodeDownloader


def _save_peers_file(nodes, directory, name):
	nodes.sort(key=lambda node: node['publicKey'])
	filename = directory / f'peers-{name}.json'
	with open(filename, 'wt', encoding='utf8') as outfile:
		json.dump({
			'knownPeers': nodes,
			'_info': f'this file contains a list of {name} peers and can be shared',
		}, outfile, indent=2)

	log.info(f'saved peers file {filename}')


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
