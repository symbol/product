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
--directoryのﾃﾞﾌｫﾙﾄ値を        $(pwc)/node（指定する場合は、絶対pathの記述が必要）
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
