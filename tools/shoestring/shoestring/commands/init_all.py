import os
import shutil
import tempfile
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.PackageResolver import download_and_extract_package


async def run_main(args):
	with tempfile.TemporaryDirectory() as temp_directory:
		await download_and_extract_package(args.package, Path(temp_directory))

		template_filepath = Path(temp_directory) / 'shoestring.ini'
		log.info(_('general-copying-file').format(source_path=template_filepath, destination_path=args.config))
		create_overrides_ini()          #overrides.iniの作成を呼ぶ
		create_rest_overrides_json()    #rest_overrides.jsonの作成を呼ぶ 
		shutil.copy(template_filepath, args.config)

		config_filepath = Path(args.config)
		ConfigurationManager(config_filepath.parent).patch(config_filepath.name, [
			('node', 'userId', os.getuid()),
			('node', 'groupId', os.getgid())
		])


#overrides.iniの作成
def create_overrides_ini():
	# overrides.iniの内容
	content = """[user.account]
enableDelegatedHarvestersAutoDetection = true

[harvesting.harvesting]
maxUnlockedAccounts = 5
beneficiaryAddress = 

[node.node]
minFeeMultiplier = 100

[node.localnode]
host = 
friendlyName = 
"""
	# shoestring/ ディレクトリを作成
	destination_dir = Path("shoestring")
	destination_dir.mkdir(parents=True, exist_ok=True)

	# overrides.ini に内容を書き込み
	log.info(_('general-copying-file').format(source_path='overrides.ini', destination_path='shoestring/overrides.ini'))
	overrides_filepath = destination_dir / 'overrides.ini'
	overrides_filepath.write_text(content, encoding='utf-8')
	print(f"Created contents of {overrides_filepath}:\n{overrides_filepath.read_text()}")


#rest_overrides.jsonの作成
def create_rest_overrides_json():
	# rest_overrides.jsonの内容
	content = """{}
"""
	# shoestring/ ディレクトリを指定
	destination_dir = Path("shoestring")

	# rest_overrides.json に内容を書き込み
	log.info(_('general-copying-file').format(source_path='rest_overrides.json', destination_path='shoestring/rest_overrides.json'))
	rest_overrides_filepath = destination_dir / 'rest_overrides.json'
	rest_overrides_filepath.write_text(content, encoding='utf-8')
	print(f"Created contents of {rest_overrides_filepath}:\n{rest_overrides_filepath.read_text()}")


def add_arguments(parser):
	parser.add_argument('--package', help=_('argument-help-setup-package'), default='mainnet')
	parser.add_argument('config', help=_('argument-help-config'), default='shoestring/shoestring.ini', action='store_const', const='shoestring/shoestring.ini')
	parser.set_defaults(func=run_main)
