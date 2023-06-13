from hashlib import sha3_512
from pathlib import Path

from aiohttp import ClientSession
from zenlog import log


def _calculate_buffer_hash(buffer):
	hasher = sha3_512()
	hasher.update(buffer)
	return hasher.hexdigest().upper()


def _calculate_file_hash(filepath):
	with open(filepath, 'rb') as infile:
		return _calculate_buffer_hash(infile.read())


async def _get_file(file_uri):
	async with ClientSession() as session:
		async with session.get(file_uri) as response:
			response_buffer = await response.read()
			if 200 != response.status:
				raise RuntimeError(f'could not download file from "{file_uri}"')

			return response_buffer


async def download_file(descriptor, output_directory):
	"""Downloads a file specified by a download descriptor."""

	descriptor_name = descriptor['name']
	output_path = Path(output_directory) / descriptor_name

	if output_path.is_file():
		if 'hash' not in descriptor:
			raise RuntimeError(f'{output_path} exists, remove manually and retry')

		if descriptor['hash'] == _calculate_file_hash(output_path):
			log.info(_('file-downloader-already-downloaded').format(name=descriptor_name))
			return

		log.info(_('file-downloader-exists-with-invalid-hash'))
		output_path.unlink()

	url = descriptor['url']
	if url.startswith('file://'):
		with open(url[6:], 'rb') as infile:
			file_buffer = infile.read()
	else:
		file_buffer = await _get_file(url)

	if 'hash' in descriptor and descriptor['hash'] != _calculate_buffer_hash(file_buffer):
		raise RuntimeError(_('file-downloader-downloaded-with-invalid-hash').format(name=descriptor_name))

	with open(output_path, 'wb') as outfile:
		outfile.write(file_buffer)
