import os
import shutil
import tempfile
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.PackageResolver import download_and_extract_package

#import configparser        #update_shoestring_ini()で使用する
from shoestring.internal.ConfigurationManager import ConfigurationManager

async def run_main(args):
	with tempfile.TemporaryDirectory() as temp_directory:
		await download_and_extract_package(args.package, Path(temp_directory))

		template_filepath = Path(temp_directory) / 'shoestring.ini'
		log.info(_('general-copying-file').format(source_path=template_filepath, destination_path=args.config))
		create_overrides_ini()          #overrides.iniの作成を呼ぶ
		create_rest_overrides_json()    #rest_overrides.jsonの作成を呼ぶ 
		shutil.copy(template_filepath, args.config)
		config_path = Path(args.config)
		print(f"Created contents of shoestring/shoestring.ini:\n{config_path.read_text()}")
		response = input("shoestring.iniがすぐ使える様に変更しますか？ [y/n]: ").strip().lower()
		if response == "y":
			update_shoestring_ini()         #shoestring.iniの更新を呼ぶ
		else:
			print("shoestring.iniの変更をキャンセルしました。")
		

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
host = localhost
friendlyName = myShoestringNode
"""
	# shoestring/ ディレクトリを作成
	destination_dir = Path("shoestring")
	destination_dir.mkdir(parents=True, exist_ok=True)

	# overrides.ini に内容を書き込み
	log.info(_('general-copying-file').format(source_path='overrides.ini', destination_path='shoestring/overrides.ini'))
	overrides_filepath = destination_dir / 'overrides.ini'
	overrides_filepath.write_text(content, encoding='utf-8')
	print(f"Created contents of {overrides_filepath}:\n{overrides_filepath.read_text()}")


def update_shoestring_ini():
	"""shoestring/shoestring.ini を更新"""
	config_file = "shoestring/shoestring.ini"
	replacements = []
	replacements.append(("features = API | HARVESTER | VOTER", "features = API | HARVESTER"))
	replacements.append(("apiHttps = true", "apiHttps = false"))
	replacements.append(("caCommonName =", "caCommonName = CA myShoestringNode"))
	replacements.append(("nodeCommonName =", "nodeCommonName = myShoestringNode"))


	try:
		with open(config_file, 'r') as f:
			content = f.read()
		for old, new in replacements:
			content = content.replace(old, new)
		with open(config_file, 'w') as f:
			f.write(content)
	except Exception as e:
		print(f"エラー: {e}")

	# ログ出力（緑色、| は白）
	log.info("ファイル shoestring.ini を更新中")

	# 更新後の内容を表示
	config_path = Path(config_file)
	print(f"Updated contents of {config_file}:\n{config_path.read_text()}")


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
	parser.add_argument('config', help=_('argument-help-config'), default='shoestring/shoestring.ini', nargs='?')
	parser.set_defaults(func=run_main)
