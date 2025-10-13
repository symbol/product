2025_07_16
```
`commands/setup.py`
`wizard/ShoestringOperation.py`
以上の 2fileを差し替える事により、
① wizardの setup実行時には、nodeﾃﾞｨﾚｸﾄﾘが作成され、nodeﾃﾞｨﾚｸﾄﾘに node本体が格納される。
② wizardの upgrade実行時には、shoestring/rest_overrides.jsonが存在する場合には、`--rest-overrides shoestring/rest_overrides.json`が引数として命令に追加される。

③ commandの setup記述で、それぞれの引数に、ﾃﾞﾌｫﾙﾄ値を設定した。
これにより、以下に挙げる引数は、条件に合致する場合は省略可能とした。
また、引数にて該当する ﾌｧｲﾙの場所と名前を明示的に記述すると、記述された引数は適用される。

`--ca-key-path ca.key.pem`の場合は、`--ca-key-path`引数を省略可能。
`--config shoestring/shoestring.ini`の場合は、`--config`引数を省略可能。
`--overrides shoestring/overrides.ini`の場合は、`--overrides`引数を省略可能。
`--directory node`の場合は、`--directory`引数を省略可能。
※1 `--directory`引数で、存在しない ﾃﾞｨﾚｸﾄﾘを指定した場合は、引数で指定した場所と名前の ﾃﾞｨﾚｸﾄﾘが新規作成され、そこに node本体が格納される。
`--package mainnet`の場合は、`--package`引数を省略可能。
`--rest-overrides shoestring/rest_overrides.json`の場合は、`--rest-overrides`引数を省略可能。
※2 `--rest-overrides`引数を省略した場合で、`shoestring/rest_overrides.json`が存在する場合は、`--rest-overrides shoestring/rest_overrides.json`が引数となり、適用される。
※3 `--rest-overrides`引数を省略した場合で、`shoestring/rest_overrides.json`が存在しない場合は、`--rest_overrides`引数は適用されない。

```
2025_07_20
```
wizard/setup_file_generator.py
wizardでの setup時に、metadataを設定した場合でも、"_info": "replace the body of this object with custom fields and objects to personalize your node"が metadataに設定されるが、
これを、metadataが設定された場合に、"_info":"This is nodeMetaData"に変更する。

```

2025_07_21
```
以下の 9つの命令fileに ﾃﾞﾌｫﾙﾄ値を設定しました。
commands/
①health.py
②reset_data.py
③renew-certificates.py
④pemtool.py
⑤renew_voting_keys.py
⑥import_bootstrap.py
⑦signer.py
⑧announce_transaction.py
⑨min_cosignatures_count.py



以下は変更内容

①health.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--directoryのﾃﾞﾌｫﾙﾄ値を        node

②reset_data.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--directoryのﾃﾞﾌｫﾙﾄ値を        node

③renew-certificates.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--directoryのﾃﾞﾌｫﾙﾄ値を        $(pwd)/node（指定する場合は、絶対pathの記述が必要）
--ca-key-pathのﾃﾞﾌｫﾙﾄ値を      ca.key.pem
--retain-node-keyのﾃﾞﾌｫﾙﾄ値を  --retain-node-keyを書いても書かなくても True（実行する）
※修正方法が判明し次第、修正予定。

④pemtool.py
--outputのﾃﾞﾌｫﾙﾄ値を           ca.key.pem
その他の引数は任意である事が必要な為、修正は無し。

⑤renew_voting_keys.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--directoryのﾃﾞﾌｫﾙﾄ値を        node

※renew_voting_keys.pyの修正後に、--directoryでの helpの表示が絶対pathになる様に、setup.pyを修正。

⑥import_bootstrap.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--include-node-key           --include-node-keyを書いても書かなくても True（実行する）

⑦signer.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--ca-key-pathのﾃﾞﾌｫﾙﾄ値を      ca.key.pem
命令例：
python3 -m shoestring signer --save node/linking_transaction.dat

⑧announce_transaction.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
命令例：
python3 -m shoestring announce-transaction --transaction node/linking_transaction.dat

⑨min_cosignatures_count.py
--configのﾃﾞﾌｫﾙﾄ値を           shoestring/shoestring.ini
--ca-key-pathのﾃﾞﾌｫﾙﾄ値を      ca.key.pem
命令例：
python -m shoestring min-cosignatures-count
python -m shoestring min-cosignatures-count --update
```

2025_07_26
```
configﾌｧｲﾙを生成する、init命令(commands/init.py)を修正、拡張した init-all命令(commands/init-all.py)を新設。
init-all命令では、configﾌｧｲﾙ名とその場所の指定は不可、命令の引数は、--packageのみとなる。

init-all命令で行われる事：
①shoestringﾃﾞｨﾚｸﾄﾘを作成
②通常の、shoestring/shoestring.iniを生成。
③wizardに準拠した書式で、shoestring/overrides.iniを生成。
④内容が'{}'の、shoestring/rest_overrides.jsonを生成。

init-all命令の実行後に、
shoestring.iniと、
overrides.iniの編集後、
(任意で、rest_overrides.jsonの編集、pemtool命令、import-bootstrap命令)
setup命令の実行で、nodeが完成する。

init-all命令の新設に伴い、__main__.pyをこれに対応させた。
```

2025_07_27
```
commands/init_all.py
shoestring.iniを生成した後
すぐ使える記述に変更するかを聞いて、
yの場合は、shoestring/shoestring.iniにすぐ使用出来る様に変更を加えます。

[node]
features = API | HARVESTER | VOTER
apiHttps = true
caCommonName =
nodeCommonName =
を

features = API | HARVESTER
apiHttps = false
caCommonName = CA myShoestringNode
nodeCommonName = myShoestringNode
に変更する。

また、同時に生成される shoestring/overrides.iniでは

[node.localnode]
host = localhost
friendlyName = myShoestringNode
上記の通り、設定を予め記述してある。

この次の命令 setupで、基本的な dualnodeが完成する。
```

2025_08_06
```
wizard/screens/obligatory.py
wizardの setupﾒﾆｭｰで、最初に表示される ｲﾝｽﾄｰﾙ先 ﾃﾞｨﾚｸﾄﾘ指定の欄の初期表示を、
$HOME/symbolから、ｶﾚﾝﾄﾃﾞｨﾚｸﾄﾘに変更。
```

2025_09_09
```
commands/upgrade.py
初回に apiHttps = false で setupした後に、apiHttps = true で upgradeを実行すると、「nginx.conf.erbが無い」ｴﾗｰが出る。
これを ｴﾗｰが出ない様に修正。
```

2025_09_20
```
address命令（commands/address.py）を新設。
nodeAccounts及び votingKeyを表示する。
```

2025_10_12
```
commands/upgrade.py
non-votingから votingへ upgradeした nodeで、renew-voting-keysを実行すると、
FileNotFoundError: [Errno 2] No such file or directory: 'node/keys/voting/private_key_tree1.dat'
ｴﾗｰが発生する。
この ｴﾗｰの対策として、upgrade時に non-voting、votingに関わらず keysﾃﾞｨﾚｸﾄﾘに votingﾃﾞｨﾚｸﾄﾘを作成する様に修正。
```

2025_10_13
```
internal/PeerDownloader.py
nodewatchの /api/symbol/nodes/peerの表記方法に変更あり。
各nodeの endpointを port3000/3001を分けて表記する変更あり。
この変更後に、setup/upgradeした votingNodeでは、renew-voting-keysに失敗する。
これに対応した。
```
----------------------------------------------------------------------------------------------
2025_07_16
```
`commands/setup.py`
`wizard/ShoestringOperation.py`
By replacing the above two files,

① When running wizard setup, the node directory is created and the node body is stored in the node directory.

② When running wizard upgrade, if shoestring/rest_overrides.json exists, `--rest-overrides shoestring/rest_overrides.json` is added as an argument to the command.

③ In the command setup description, a default value is set for each argument.

As a result, the arguments listed below can be omitted if the conditions are met.

Also, if the location and name of the corresponding file are explicitly stated in the argument, the described argument will be applied.

In the case of `--ca-key-path ca.key.pem`, the `--ca-key-path` argument can be omitted.
If you use `--config shoestring/shoestring.ini`, you can omit the `--config` argument.
If you use `--overrides shoestring/overrides.ini`, you can omit the `--overrides` argument.
If you use `--directory node`, you can omit the `--directory` argument.
*1 If you specify a directory that does not exist with the `--directory` argument, a new directory with the location and name specified in the argument will be created, and the node body will be stored there.
If you use `--package mainnet`, you can omit the `--package` argument.
If you use `--rest-overrides shoestring/rest_overrides.json`, you can omit the `--rest-overrides` argument.
*2 If the `--rest-overrides` argument is omitted and `shoestring/rest_overrides.json` exists, `--rest-overrides shoestring/rest_overrides.json` will be applied as an argument.

*3 If the `--rest-overrides` argument is omitted and `shoestring/rest_overrides.json` does not exist, the `--rest_overrides` argument will not be applied.

```
2025_07_20
```
wizard/setup_file_generator.py
Even if you set metadata during setup in the wizard, "_info": "replace the body of this object with custom fields and objects to personalize your node" will be set in the metadata,
but if metadata is set, this will be changed to "_info":"This is nodeMetaData".

```

2025_07_21
```
The following 9 command files have been set to default values.
commands/
①health.py
②reset_data.py
③renew-certificates.py
④pemtool.py
⑤renew_voting_keys.py
⑥import_bootstrap.py
⑦signer.py
⑧announce_transaction.py
⑨min_cosignatures_count.py

The following are the changes

①health.py
--config default value shoestring/shoestring.ini
--directory default value node

②reset_data.py
--config default value shoestring/shoestring.ini
--directory default value node

③renew-certificates.py
--config default value shoestring/shoestring.ini
--directory default value $(pwd)/node (must specify absolute path)
--ca-key-path default value ca.key.pem
--retain-node-key default value True (executes) whether retain-node-key is written or not
*Planned to be fixed as soon as a fix is found for the issue where only absolute values can be written.

④pemtool.py
--output default value ca.key.pem
Other arguments need to be optional, so no fixes.

⑤renew_voting_keys.py
--config default value shoestring/shoestring.ini
--directory default value node

*After fixing renew_voting_keys.py, fix setup.py so that the help displayed for --directory is an absolute path.

⑥import_bootstrap.py
--Set the default value of config to shoestring/shoestring.ini
--include-node-key --True whether you write include-node-key or not (execute)

⑦signer.py
--Set the default value of config to shoestring/shoestring.ini
--Set the default value of ca-key-path to ca.key.pem
Example command:
python3 -m shoestring signer --save node/linking_transaction.dat

⑧announce_transaction.py
--Set the default value of config to shoestring/shoestring.ini
Example command:
python3 -m shoestring announce-transaction --transaction node/linking_transaction.dat

⑨min_cosignatures_count.py
--Set the default value of config shoestring/shoestring.ini
--ca-key-path default value ca.key.pem
Example command:
python -m shoestring min-cosignatures-count
python -m shoestring min-cosignatures-count --update
```

2025_07_26
```
The init command (commands/init.py) that generates a config file has been modified and expanded to create a new init-all command (commands/init-all.py).
The init-all command does not allow you to specify the config file name or location, and the only argument to the command is --package.

What the init-all command does:
①Creates a shoestring directory
②Generates the normal shoestring/shoestring.ini.
③Generates shoestring/overrides.ini in a format that conforms to the wizard.
④Generates shoestring/rest_overrides.json with the contents '{}'.

After executing the init-all command,
after editing shoestring.ini and
overrides.ini (optionally, edit rest_overrides.json, use the pemtool command, and the import-bootstrap command),
the node is completed by executing the setup command.

With the introduction of the new init-all command, __main__.py has been updated to comply with it.
```

2025_07_27
```
commands/init_all.py
After shoestring.ini is generated,
you are asked whether you want to change it to a ready-to-use description.
If you answer y, make changes to shoestring/shoestring.ini so that it can be used immediately.

[node]
features = API | HARVESTER | VOTER
apiHttps = true
caCommonName =
nodeCommonName =
change to

features = API | HARVESTER
apiHttps = false
caCommonName = CA myShoestringNode
nodeCommonName = myShoestringNode
.

In shoestring/overrides.ini, which is generated at the same time,

[node.localnode]
host = localhost
friendlyName = myShoestringNode
the settings are written in advance as shown above.

The next command, setup, completes the basic dualnode.
```

2025_08_06
```
wizard/screens/obligatory.py
In the wizard setup menu, the initial display for the installation directory field has been changed from $HOME/symbol to the current directory.
```

2025_09_09
```
commands/upgrade.py
If initially set up with apiHttps = false and then run an upgrade with apiHttps = true, 
will get an error saying "nginx.conf.erb is missing."
This has been fixed so that the error does not occur.
```

2025_09_20
```
Added the address command (commands/address.py).
Displays nodeAccounts and votingKeys.
```

2025_10_12
```
commands/upgrade.py
When running renew-voting-keys on a node that has been upgraded from non-voting to voting, 
the error FileNotFoundError: [Errno 2] No such file or directory: 'node/keys/voting/private_key_tree1.dat' occurs.
To address this error, we've modified the upgrade.py so that a voting directory is created in the keys directory, regardless of whether the node is non-voting or voting.
```

2025_10_13
```
internal/PeerDownloader.py
The notation for /api/symbol/nodes/peer in nodewatch has been changed.
Each node's endpoint has been changed to be represented as separate ports 3000/3001.
After this change, renew-voting-keys failed on voting nodes that were set up or upgraded.
This has been addressed.
```
