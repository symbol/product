import json
import tempfile
from pathlib import Path
from zipfile import ZipFile

import pytest
from aiohttp import web

from shoestring.internal.PackageResolver import download_and_extract_package, resolve_package

from ..test.TestPackager import prepare_testnet_package

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockReleasesServer:
		def __init__(self):
			self.urls = []

		async def api_symbol_height(self, request):
			return await self._process(request, [
				{
					'tag_name': 'client/catapult/4',
					'assets': [{'name': 'alpha-444', 'browser_download_url': 'www.symbol.com/a444.zip', 'tag': 'a'}]
				},
				{
					'tag_name': 'client/catapult/x',
				},
				{
					'tag_name': 'client/catapult/3',
					'assets': [{'name': 'alpha-333', 'browser_download_url': 'www.symbol.com/a333.zip', 'tag': 'b'}]
				},
				{
					'tag_name': 'sdk/javascript/2',
					'assets': [{'name': 'beta-222', 'browser_download_url': 'www.symbol.com/b222.zip', 'tag': 'c'}]
				},
				{
					'tag_name': 'client/catapult/1',
					'assets': [
						{'name': 'gamma-112', 'browser_download_url': 'www.symbol.com/g112.zip', 'tag': 'd'},
						{'name': 'gamma-115', 'browser_download_url': 'www.symbol.com/g115.zip', 'tag': 'e'}
					]
				},
				{
					'tag_name': 'client/catapult/v1.0.3.7',
					'assets': [{'name': 'latest', 'browser_download_url': 'www.symbol.com/latest.zip', 'tag': 'client/catapult/v1.0.3.7'}]
				}
			])

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockReleasesServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/releases', mock_server.api_symbol_height)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server


# endregion


# pylint: disable=invalid-name

# region mainnet

async def _assert_mainnet_resolution_success(server, asset_prefix, expected_download_descriptor):  # pylint: disable=redefined-outer-name
	# Act:
	download_descriptor = await resolve_package('mainnet', releases_uri=f'{server.make_url("")}/releases', asset_prefix=asset_prefix)

	# Assert:
	assert [f'{server.make_url("")}/releases'] == server.mock.urls
	assert expected_download_descriptor == download_descriptor


async def test_mainnet_resolution_returns_first_release_with_matching_asset(server):  # pylint: disable=redefined-outer-name
	# Assert: client/catapult/4 is the first release that has an asset starting with "alpha" (partial match)
	await _assert_mainnet_resolution_success(server, 'alpha', {
		'name': 'configuration-package.zip',
		'url': 'www.symbol.com/a444.zip'
	})


async def test_mainnet_resolution_returns_first_release_with_exact_matching_asset(server):  # pylint: disable=redefined-outer-name
	# Assert: client/catapult/3 is the first release that has an asset starting with "alpha-333" (exact match)
	await _assert_mainnet_resolution_success(server, 'alpha-333', {
		'name': 'configuration-package.zip',
		'url': 'www.symbol.com/a333.zip'
	})


async def test_mainnet_resolution_returns_first_matching_asset_within_first_release(server):  # pylint: disable=redefined-outer-name
	# Assert: client/catapult/1 has two matching assets but the first is returned
	await _assert_mainnet_resolution_success(server, 'gamma-112', {
		'name': 'configuration-package.zip',
		'url': 'www.symbol.com/g112.zip'
	})


async def test_mainnet_resolution_returns_official_hash_when_available(server):  # pylint: disable=redefined-outer-name
	await _assert_mainnet_resolution_success(server, 'latest', {
		'name': 'configuration-package.zip',
		'url': 'www.symbol.com/latest.zip',
		'hash': (
			'B29BF7359B4893BB31798D125E8B9502F2CBBD7DEC078E6338A545B03D5BB6CF'
			'905003720124A766A79B600BE80DF82D7D48F9AE14600A58E3F77F25B68446F4'
		)
	})


async def _assert_cannot_find_asset(server, asset_prefix):  # pylint: disable=redefined-outer-name
	with pytest.raises(RuntimeError):
		await resolve_package('mainnet', releases_uri=f'{server.make_url("")}/releases', asset_prefix=asset_prefix)


async def test_mainnet_resolution_fails_when_non_catapult_release_has_matching_asset(server):  # pylint: disable=redefined-outer-name
	await _assert_cannot_find_asset(server, 'beta')  # matches asset in sdk/javascript/2 release


async def test_mainnet_resolution_fails_when_no_release_has_matching_asset(server):  # pylint: disable=redefined-outer-name
	await _assert_cannot_find_asset(server, 'alpha-000')  # no asset name starts with this prefix

# endregion


# region testnet

async def test_testnet_resolution_can_resolve_named_testnet(server):  # pylint: disable=redefined-outer-name
	# Act:
	download_descriptor = await resolve_package('sai', releases_uri=f'{server.make_url("")}/releases')

	# Assert:
	assert [] == server.mock.urls
	assert {
		'name': 'configuration-package.zip',
		'url': 'https://github.com/symbol/networks/archive/refs/heads/sai.zip'
	} == download_descriptor


async def test_testnet_resolution_can_resolve_custom_testnet(server):  # pylint: disable=redefined-outer-name
	# Act:
	download_descriptor = await resolve_package('https://foo.zip', releases_uri=f'{server.make_url("")}/releases')

	# Assert:
	assert [] == server.mock.urls
	assert {
		'name': 'configuration-package.zip',
		'url': 'https://foo.zip'
	} == download_descriptor

# endregion


# region download_and_extract_package

@pytest.fixture
def package_server(event_loop, aiohttp_client):
	class MockPackageServer:
		def __init__(self):
			self.urls = []
			self.package_path = None

		def initialize_package(self, directory):
			self.package_path = prepare_testnet_package(directory, 'foobar.zip')

		async def package(self, request):
			self.urls.append(str(request.url))
			return web.FileResponse(self.package_path)

	# create a mock server
	mock_server = MockPackageServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/package.zip', mock_server.package)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server


async def test_can_download_and_extract(package_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as server_directory_name:
		package_server.mock.initialize_package(Path(server_directory_name))

		with tempfile.TemporaryDirectory() as output_directory_name:
			output_directory = Path(output_directory_name)

			# Act: instead of passing network name, pass full URI
			await download_and_extract_package(str(package_server.make_url('/package.zip')), output_directory)

			# Assert:
			top_level_names = sorted([path.name for path in output_directory.iterdir()])
			assert [
				'README.md',
				'configuration-package.zip',
				'mongo',
				'resources',
				'rest',
				'seed',
				'shoestring.ini'
			] == top_level_names


async def _assert_can_download_and_extract_local_package_using_file_protocol(add_files_to_archive):
	# Arrange: prepare dummy source file
	with tempfile.TemporaryDirectory() as source_directory_name:
		source_filepath = Path(source_directory_name) / 'foo.zip'
		with ZipFile(source_filepath, 'w') as archive:
			add_files_to_archive(archive)

		with tempfile.TemporaryDirectory() as output_directory_name:
			output_directory = Path(output_directory_name)

			# Act:
			await download_and_extract_package(f'file://{source_filepath}', output_directory)

			# Assert:
			temp_files = sorted(list(path.name for path in output_directory.iterdir()))
			assert ['configuration-package.zip', 'other', 'seed'] == temp_files

			# - check file contents
			with open(output_directory / 'seed' / 'index.dat', 'rb') as infile:
				file_contents = infile.read()
				assert b'abc' == file_contents

			with open(output_directory / 'other' / 'other.dat', 'rb') as infile:
				file_contents = infile.read()
				assert b'def' == file_contents


async def test_can_download_and_extract_local_package_using_file_protocol():
	# Arrange
	def add_files_to_archive(archive):
		archive.writestr(str(Path('seed') / 'index.dat'), 'abc')
		archive.writestr(str(Path('other') / 'other.dat'), 'def')

	# Act + Assert:
	await _assert_can_download_and_extract_local_package_using_file_protocol(add_files_to_archive)


async def test_can_find_seed_directory_one_level_down():
	# Arrange
	def add_files_to_archive(archive):
		archive.writestr(str(Path('foo/seed') / 'index.dat'), 'abc')
		archive.writestr(str(Path('foo/other') / 'other.dat'), 'def')

	# Act + Assert:
	await _assert_can_download_and_extract_local_package_using_file_protocol(add_files_to_archive)


async def test_cannot_find_seed_directory_multiple_levels_down():
	# Arrange
	def add_files_to_archive(archive):
		archive.writestr(str(Path('foo/bar/seed') / 'index.dat'), 'abc')
		archive.writestr(str(Path('foo/bar/other') / 'other.dat'), 'def')

	# Act + Assert:
	with pytest.raises(RuntimeError):
		await _assert_can_download_and_extract_local_package_using_file_protocol(add_files_to_archive)


# endregion
