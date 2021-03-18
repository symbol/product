import os
from hashlib import sha3_512

import requests
from zenlog import log


def calculate_buffer_hash(buffer):
    hasher = sha3_512()
    hasher.update(buffer)
    return hasher.hexdigest().upper()


def calculate_file_hash(filepath):
    with open(filepath, 'rb') as input_file:
        return calculate_buffer_hash(input_file.read())


def download_file(output_dir, descriptor):
    descriptor_name = descriptor['name']
    output_path = output_dir / descriptor_name

    if output_path.is_file():
        if descriptor['hash'] == calculate_file_hash(output_path):
            log.info(f'proper file already downloaded ({descriptor_name})')
            return

        log.warn('file exists, but has invalid hash, re-downloading')
        os.remove(output_path)

    req = requests.get(descriptor['url'])
    if 200 != req.status_code:
        raise RuntimeError(f'could not download file ({descriptor_name}), try again')

    if descriptor['hash'] != calculate_buffer_hash(req.content):
        raise RuntimeError(f'downloaded file ({descriptor_name}) has invalid hash')

    with open(output_path, 'wb') as output_file:
        output_file.write(req.content)
