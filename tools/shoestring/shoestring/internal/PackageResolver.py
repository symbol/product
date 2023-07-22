import shutil
from zipfile import ZipFile

from aiohttp import ClientSession

from .FileDownloader import download_file

SYMBOL_GITHUB_URI = 'https://api.github.com/repos/symbol/symbol/releases'
OFFICIAL_HASHES = {
	'client/catapult/v1.0.3.5': (
		'0000000000000000000000000000000000000000000000000000000000000000'
		'0000000000000000000000000000000000000000000000000000000000000000'
	)
}


async def _get_releases(releases_uri):
	async with ClientSession() as session:
		async with session.get(releases_uri) as response:
			response_json = await response.json()
			return response_json


def _find_asset(releases, asset_prefix):
	for release in releases:
		tag_name = release['tag_name']
		if not tag_name.startswith('client/catapult'):
			continue

		if not release.get('assets'):
			continue

		for asset in release['assets']:
			if asset['name'].startswith(asset_prefix):
				return {
					'tag': tag_name,
					'asset': asset
				}

	raise RuntimeError(f'couldn\'t find asset {asset_prefix}')


def _resolve_testnet_name(name):
	if name in ('https://github.com/symbol/networks/tree/sai', 'sai'):
		return 'https://github.com/symbol/networks/archive/refs/heads/sai.zip'

	return name


async def resolve_package(package_identifier, asset_prefix='configuration-mainnet', releases_uri=SYMBOL_GITHUB_URI):
	"""Resolves a package identifier into an object specifying download instructions."""

	if 'mainnet' == package_identifier:
		releases = await _get_releases(releases_uri)
		asset_descriptor = _find_asset(releases, asset_prefix)
		download_descriptor = {
			'name': 'configuration-package.zip',
			'url': asset_descriptor['asset']['browser_download_url']
		}

		if asset_descriptor['tag'] in OFFICIAL_HASHES:
			download_descriptor['hash'] = OFFICIAL_HASHES[asset_descriptor['tag']]

		return download_descriptor

	url = _resolve_testnet_name(package_identifier)
	return {
		'name': 'configuration-package.zip',
		'url': url
	}


def _move_to_parent(destination_directory):
	# github generated zips have additional subdirectory on top-level
	# if it's zipfile like that, just move all the files up

	seed_directory = destination_directory / 'seed'
	if seed_directory.exists():
		return

	# find dir that contains extracted package
	for subdir in destination_directory.glob('*'):
		if not subdir.is_dir():
			continue

		seed_directory = subdir / 'seed'
		if not seed_directory.is_dir():
			continue

		for file in subdir.glob('*'):
			shutil.move(str(file), str(destination_directory))

		subdir.rmdir()

		break
	else:
		raise RuntimeError('could not find package candidate directory')


async def download_and_extract_package(package_identifier, destination_directory):
	"""Downloads and extracts configuration package."""

	download_descriptor = await resolve_package(package_identifier)
	await download_file(download_descriptor, destination_directory)

	# extract all to temp directory
	with ZipFile(destination_directory / 'configuration-package.zip') as package:
		package.extractall(destination_directory)

	_move_to_parent(destination_directory)
