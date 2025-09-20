# shoestring/commands/address.py

import sys
import os
import re
import glob
import argparse
import configparser
from getpass import getpass
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.KeyPair import KeyPair

NODE_KEY_PEM = "/cert/node.key.pem"
REMOTE_KEY_PEM = "/remote.pem"
VRF_KEY_PEM = "/vrf.pem"

def xxd_epoch(file_path):
    try:
        with open(file_path, 'rb') as f:
            f.seek(0x0001)
            byte1_start = f.read(1)
            f.seek(0x0000)
            byte2_start = f.read(1)
            f.seek(0x0009)
            byte1_end = f.read(1)
            f.seek(0x0008)
            byte2_end = f.read(1)
           
            if not byte1_start or not byte2_start or not byte1_end or not byte2_end:
                print("Error: File is too short to read specified offsets.")
                return
           
            hex_start = byte1_start.hex() + byte2_start.hex()
            dec_start = int(hex_start, 16)
            hex_end = byte1_end.hex() + byte2_end.hex()
            dec_end = int(hex_end, 16)
           
            print("StartEpoch:\t" + str(dec_start))
            print("EndEpoch:\t" + str(dec_end))
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
    except Exception as e:
        print(f"Error: {e}")

def xxd_like_dump(file_path, start_offset=0x0020, end_offset=0x003f, lines_per_page=24):
    try:
        with open(file_path, 'rb') as f:
            f.seek(start_offset)
            offset = start_offset
            line_count = 0
            hex_concatenated = ""
            
            while offset <= end_offset:
                chunk = f.read(min(16, end_offset - offset + 1))
                if not chunk:
                    break
                for b in chunk:
                    hex_concatenated += f"{b:02X}"
                offset += 16
                line_count += 1
                if line_count % lines_per_page == 0:
                    input("Press Enter to continue...")
            
            print(f"publicKey:\t{hex_concatenated}")
            xxd_epoch(file_path)
            print(f"filename:\t{os.path.basename(file_path)}")

    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
    except Exception as e:
        print(f"Error: {e}")

def process_voting_keys():
    voting_dirs = [
        os.path.normpath("keys/voting"),
        os.path.normpath("node/keys/voting")
    ]
    
    voting_dir = None
    for dir_path in voting_dirs:
        if os.path.exists(dir_path):
            voting_dir = dir_path
            break
    
    if not voting_dir:
        print("votingKeyはありません。")
        return
    
    files = glob.glob(os.path.join(voting_dir, "private_key_tree*.dat"))
    if not files:
        print("votingKeyはありません。")
        return
    
    print("votingKey情報:\t")
    def get_number(filename):
        match = re.search(r'private_key_tree(\d+)\.dat', filename)
        return int(match.group(1)) if match else 0
    
    sorted_files = sorted(files, key=get_number, reverse=True)
    for i, file_path in enumerate(sorted_files):
        xxd_like_dump(file_path)
        if i < len(sorted_files) - 1:
            print()

def get_network_name(config_path):
    config = configparser.ConfigParser()
    paths_to_check = [config_path, os.path.normpath(os.path.join(os.path.dirname(os.getcwd()), "shoestring", "shoestring.ini"))]
    
    for path in paths_to_check:
        try:
            if os.path.exists(path):
                config.read(path, encoding="utf-8")
                return config.get("network", "name", fallback="testnet")
        except Exception:
            continue
    print("shoestring.ini が見つかりませんでした。デフォルトの 'testnet' を使用します。")
    return "testnet"

def read_public_keys_from_pem_chain(cert_path):
    paths_to_check = [cert_path]
    if os.path.basename(cert_path) == "node.full.crt.pem":
        node_path = os.path.normpath(os.path.join("node", cert_path))
        paths_to_check.append(node_path)
    
    for path in paths_to_check:
        try:
            with open(path, "rb") as cert_file:
                pem_data = cert_file.read()
                certs = pem_data.split(b"-----END CERTIFICATE-----")
                public_keys = []
                for cert_pem in certs:
                    cert_pem = cert_pem.strip()
                    if cert_pem:
                        cert_pem += b"\n-----END CERTIFICATE-----\n"
                        cert = x509.load_pem_x509_certificate(cert_pem, default_backend())
                        der_bytes = cert.public_key().public_bytes(
                            encoding=serialization.Encoding.DER,
                            format=serialization.PublicFormat.SubjectPublicKeyInfo,
                        )[12:]
                        public_keys.append(der_bytes)
                return public_keys
        except Exception:
            continue
    print(f"{os.path.basename(cert_path)} が見つかりませんでした。")
    return []

def read_private_key_from_pem(pem_path):
    paths_to_check = [pem_path]
    if os.path.basename(pem_path) != "ca.key.pem":
        node_path = os.path.normpath(os.path.join("node", pem_path))
        paths_to_check.append(node_path)
    if os.path.basename(pem_path) == "ca.key.pem":
        parent_path = os.path.join(os.path.dirname(pem_path), "..", "ca.key.pem")
        paths_to_check.append(os.path.normpath(parent_path))
    
    for path in paths_to_check:
        try:
            with open(path, "rb") as ca_key_file:
                ca_key_data = ca_key_file.read()
                try:
                    private_key_obj = serialization.load_pem_private_key(
                        ca_key_data, password=None, backend=default_backend()
                    )
                except (ValueError, TypeError):
                    password = getpass(f"Enter password for {os.path.basename(path)}: ")
                    if not password:
                        print(f"Password not provided for {os.path.basename(path)}.")
                        continue
                    try:
                        private_key_obj = serialization.load_pem_private_key(
                            ca_key_data, password=password.encode('utf-8'), backend=default_backend()
                        )
                    except Exception as e:
                        print(f"Failed to decrypt {os.path.basename(path)}: Invalid password or corrupted key.")
                        continue
                der_bytes = private_key_obj.private_bytes(
                    encoding=serialization.Encoding.DER,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )[16:]
                return der_bytes.hex().upper()
        except FileNotFoundError:
            continue
    print(f"{os.path.basename(pem_path)} が見つかりませんでした。")
    return None

def show_account_info(args, facade, account_type, private_key_path, cert_index, label):
    private_key_hex = read_private_key_from_pem(private_key_path)
    if private_key_hex is not None:
        key_pair = KeyPair(PrivateKey(private_key_hex))
        private_public_key = key_pair.public_key
    else:
        private_public_key = None
    
    cert_public_key = None
    cert_public_account = None
    if account_type in ("main", "node"):
        cert_public_keys = read_public_keys_from_pem_chain(
            args.keys_path + "/cert/node.full.crt.pem"
        )
        if not cert_public_keys or len(cert_public_keys) <= cert_index:
            print(f"証明書から{label}公開鍵の取得に失敗しました。")
            return
        cert_public_key = PublicKey(cert_public_keys[cert_index])
        cert_public_account = facade.create_public_account(cert_public_key)
        if private_public_key is not None and private_public_key != cert_public_key:
            print(f"{label}証明書の秘密鍵と公開鍵が一致しません。")
            return
    
    print(f"{label}アカウント情報:\t")
    if cert_public_account:
        print(f"アドレス:\t{cert_public_account.address}")
        print(f"公開鍵:\t\t{cert_public_key}")
    elif private_public_key is not None:
        account = facade.create_public_account(private_public_key)
        print(f"アドレス:\t{account.address}")
        print(f"公開鍵:\t\t{private_public_key}")
    else:
        print(f"{label}キーの秘密鍵が読み込めませんでした。")
        return
    if args.show_private_key and private_key_hex is not None:
        print(f"秘密鍵:\t\t{private_key_hex}")
    print()

def show_all_keys(args):
    facade = SymbolFacade(get_network_name(args.config))
    show_account_info(args, facade, "main", args.ca_key_path, 1, "メイン")
    show_account_info(args, facade, "node", args.keys_path + NODE_KEY_PEM, 0, "ノード")
    show_account_info(args, facade, "remote", args.keys_path + REMOTE_KEY_PEM, None, "リモート")
    show_account_info(args, facade, "vrf", args.keys_path + VRF_KEY_PEM, None, "VRF")

async def link_node_keys(args):
    print("ノードキーをリンクする機能はまだ実装されていません。")
    return None

async def unlink_node_keys(args):
    print("ノードキーをアンリンクする機能はまだ実装されていません。")
    return None

def show_voting_keys(args):
    process_voting_keys()

def get_common_showkey_args():
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument(
        "-c", "--config", type=str, default="shoestring/shoestring.ini",
        help="ノードコンフィグパス[default: shoestring/shoestring.ini]"
    )
    parent.add_argument(
        "-ca", "--ca-key-path", type=str, default="ca.key.pem",
        help="CA証明書パス[default: ca.key.pem]"
    )
    parent.add_argument(
        "-k", "--keys-path", type=str, default="keys",
        help="keysディレクトリパス[default: keys]"
    )
    parent.add_argument(
        "-p", "--show-private-key", action="store_true",
        help="プライベートキーを表示する"
    )
    return parent

def get_common_link_args():
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument(
        "-c", "--config", type=str, default="shoestring/shoestring.ini",
        help="ノードコンフィグパス[default: shoestring/shoestring.ini]"
    )
    parent.add_argument(
        "-k", "--keys-path", type=str, default="keys",
        help="keysディレクトリパス[default: keys]"
    )
    return parent

class CustomHelpFormatter(argparse.RawTextHelpFormatter):
    """サブコマンドのヘルプをタブで揃えるカスタムフォーマッター"""
    def _format_action(self, action):
        if isinstance(action, argparse._SubParsersAction):
            parts = []
            parts.append(self._format_action_invocation(action))
            parts.append('\n')
            subcommands = [
                ('show-key', 'すべてのノードキー情報を表示'),
                ('show-key -p', 'すべてのノードキー情報を表示（秘密鍵も表示する）'),
                ('link', 'ハーベスティングリンク'),
                ('unlink', 'ハーベスティングアンリンク'),
                ('show-voting', '投票キー情報を表示'),
            ]
            for cmd, help_text in subcommands:
                parts.append(f"  {cmd:<12}\t{help_text}")
            parts.append('\n')
            return '\n'.join(parts)
        return super()._format_action(action)

class CustomArgumentParser(argparse.ArgumentParser):
    """カスタムパーサーでエラー時のヘルプ表示を抑制し、フォーマッターを適用"""
    def __init__(self, *args, **kwargs):
        kwargs['formatter_class'] = CustomHelpFormatter
        super().__init__(*args, **kwargs)
    
    def error(self, message):
        sys.exit(2)
    
    def print_help(self, file=None):
        self._print_message(self.format_help(), file)

def add_arguments(parser):
    """addressサブコマンドの引数を定義"""
    # parser を CustomArgumentParser に置き換え
    custom_parser = CustomArgumentParser(
        prog=parser.prog,
        description=parser.description,
        formatter_class=CustomHelpFormatter,
        add_help=True  # -h を有効化
    )
    custom_parser.set_defaults(func=main)
    subparsers = custom_parser.add_subparsers(title="サブコマンド", metavar="", dest="command", required=False)
    
    show_common_args = [get_common_showkey_args()]
    show_parser = subparsers.add_parser(
        "show-key", help="すべてのノードキー情報を表示", parents=show_common_args, add_help=True
    )
    show_parser.set_defaults(func=show_all_keys)
    
    link_common_args = [get_common_link_args()]
    link_parser = subparsers.add_parser(
        "link", help="ハーベスティングリンク", parents=link_common_args, add_help=True
    )
    link_parser.set_defaults(func=link_node_keys)
    
    unlink_parser = subparsers.add_parser(
        "unlink", help="ハーベスティングアンリンク", parents=link_common_args, add_help=True
    )
    unlink_parser.set_defaults(func=unlink_node_keys)
    
    voting_parser = subparsers.add_parser(
        "show-voting", help="投票キー情報を表示", parents=[], add_help=True
    )
    voting_parser.set_defaults(func=show_voting_keys)
    
    # 元の parser にカスタムパーサーの設定を反映
    parser.__dict__.update(custom_parser.__dict__)

async def main(args):
    """addressサブコマンドのメイン処理"""
    if not hasattr(args, 'config'):
        args.config = "shoestring/shoestring.ini"
    if not hasattr(args, 'ca_key_path'):
        args.ca_key_path = "ca.key.pem"
    if not hasattr(args, 'keys_path'):
        args.keys_path = "keys"
    if not hasattr(args, 'show_private_key'):
        args.show_private_key = True
    if not hasattr(args, 'command') or not args.command:
        args.command = "show-key"
        args.show_private_key = True
        show_all_keys(args)
        print()
        process_voting_keys()
    else:
        if hasattr(args, 'func'):
            if args.command == "show-key":
                show_all_keys(args)
                print()
                process_voting_keys()
            elif args.command == "show-voting":
                show_voting_keys(args)
            else:
                await args.func(args)
        else:
            args.show_private_key = True
            show_all_keys(args)
            print()
            process_voting_keys()
    return None
