# 公開アカウント世代の有効性と移行

## 目的・範囲

Puller が公開世代の高さとロールバックによる失効を保持し、後続 REST が更新処理中でも世代の利用可否を判定できるようにする。REST の参照条件やレスポンスはこの変更では変更しない。

## データと状態

- `symbol_account_refresh_accounts.address_height`: 当該世代のノード応答 `account.addressHeight`。既存世代は復元できないため NULL。
- `symbol_account_refresh_state.last_successful_run_id`: 公開世代。`previous_successful_run_id` と `running_run_id` はそれぞれ直前と実行中の世代。
- `valid_run_id`: Puller が検出したロールバックによって失効していない新方式の公開世代の ID。NULL は未検証または失効。
- `height_ready_run_id`: 世代別高さの準備が完了した公開世代の ID。NULL は未検証。ロールバックによる失効では保持する。
- `last_completed_at`: 公開の正常完了時刻。更新開始・失敗・回復では更新せず、鮮度の基準とする。
- `status` は既存の更新処理状態として維持する。`is_retention_ready` は整理の移行保護用であり、上記の証明には使わない。

| 操作 | 公開 ID・完了時刻 | valid_run_id | height_ready_run_id | status |
| --- | --- | --- | --- | --- |
| 既存 DB の移行 | 維持 | NULL | NULL | 維持 |
| 更新開始 | 維持 | 維持 | 維持 | refreshing |
| 更新失敗・放棄更新の回復 | 維持 | 維持 | 維持 | unhealthy |
| ロールバックの分岐高さが最終完了高さ以下 | 維持 | NULL | 維持 | stale |
| 正常公開 | 新 ID・新完了時刻へ切替 | 新 ID | 新 ID | healthy |

現状の正常な状態遷移では、有効な公開世代に対して両 ID は公開 ID と一致する。`valid_run_id` が示すのは Puller が検出したロールバックによる失効の有無であり、取得中のノード状態がチェーン全体で常に一貫することや、未検出の分岐が存在しないことを保証しない。両 ID は追加のチェーン正当性保証ではない。

正常公開は、アカウント・モザイクの取得と重要度・ランキングの作成後に、所有者を確認した上で ID、直前 ID、完了時刻、実行中 ID、両証明を同一トランザクションで更新する。失敗時は未完成世代を公開しない。整理は有効性によらず公開・直前・実行中 ID を保護する。

## 移行とデプロイ

追加列は既存データを保持し、既存世代を `symbol_accounts` の現在値で補完しない。再実行可能な追加移行を使用する。DDL を実行する Puller の DB ロールには対象テーブルの所有権など PostgreSQL の ALTER TABLE に必要な権限が必要である。superuser は前提としない。稼働環境の実際の権限は導入前に確認する。

### 追加移行時のロック

新 Puller の最初の `sync_block_headers` または `refresh_accounts` は workflow lock を取得した後、`create_tables` を呼び、必要な追加移行を実行する。今回の `ALTER TABLE` の対象は `symbol_account_refresh_state` と `symbol_account_refresh_accounts` の2テーブルである。追加する列はいずれも NULL 可能でデフォルトがなく、既存値の補完やテーブル全体の書き換えは行わない。`address_height` を NULL 可能とするのは旧世代の高さを復元できないためであり、新方式では公開時に欠落を拒否する。

ただし `ALTER TABLE` は `ACCESS EXCLUSIVE` ロックを取得するため、既存の読み取りトランザクションの完了を待つことがある。ロック待ちが後続の読み取りなどにも影響し得る。取得したロックは `create_tables` のトランザクション完了まで保持される。追加列が存在すれば、今回追加した `ALTER TABLE` を実行しないが、それ以外の初期化処理によるロックは発生し得る。現在の実装は移行専用の `lock_timeout` を設定しない。PostgreSQL のロックと列追加については [ALTER TABLE](https://www.postgresql.org/docs/16/sql-altertable.html) と [明示的ロック](https://www.postgresql.org/docs/16/explicit-locking.html) を参照。

低負荷時間帯に導入するか、適切なセッションの `lock_timeout` を設定して事前移行を行う。事前移行時は既存 workflow と同じ排他制御・接続の扱いと実行ロールの権限を確保する。タイムアウト時はトランザクションのロールバックを確認し、阻害している処理を確認してから再実行する。具体的な事前移行コマンドは未検証のため掲載しない。

### 導入順

1. 旧 Puller の全 writer を停止してから Puller の移行・更新を導入する。旧・新 Puller を同時に実行しない。旧 REST は追加列を参照せず、従来どおり healthy かつ鮮度上限内の公開世代だけを返す。refreshing・unhealthy・stale では従来どおり利用不可。移行済みの旧世代を新方式で利用可能と見なさない。
2. 新 Puller の更新を正常公開する。正常完了まで新方式の証明は設定されない。初回正常公開より先に新 REST を導入した場合、必要な条件が満たされるまで対象 API は利用不可となる。更新失敗時は旧 REST の既存の status 判定に従い、新 REST への切替は保留する。
3. 後続 REST を導入する。`last_successful_run_id` が存在し、両証明 ID と一致し、`last_completed_at` が鮮度上限内であることを、同一の整合した読み取りで確認する。HEIGHT 順は同じ公開 ID の世代別 `address_height` を使用する。処理状態の許可範囲とレスポンスは後続 REST の契約で決める。

旧 Puller は追加列を保守せず、ロールバック失効の記録も行わないため、新 REST を使ったまま旧 Puller に戻すことは非互換である。旧 Puller に戻す場合は先に新 REST による新方式の読み取りを停止し、旧 REST の制約に戻す。再び新 REST を使う前には新 Puller に戻し、新方式の世代の正常公開を確認する。公開 ID と両証明 ID の一致だけでは旧 Puller 稼働後の再公開を証明できないため、新 Puller による再公開の実行結果と完了時刻も確認する。旧 Puller 稼働中の状態を新方式の証明として信頼しない運用が必要である。

## 後続 REST の受入項目

公開 ID と両証明の不一致・NULL、失効、鮮度超過、refreshing・失敗・放棄回復、正常公開との競合を検証する。HEIGHT 順が同一世代の高さを使い、現状態の変更や削除に影響されないことを確認する。想定クエリと実測を踏まえて世代別高さのインデックスの必要性を判断する。
