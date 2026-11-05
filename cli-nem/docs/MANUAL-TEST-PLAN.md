# wallet-common-nem — Manual / Integration Test Plan

Live testnet validation of every `src/api` service, the transfer flow
(fetch account → create → fee → sign → announce → verify), and every transaction type
producible via `TransferModule` / `utils/transaction-to-nem`.

## Environment

- **Harness:** `scripts/manual-wallet-cli.js` (run via `node --loader ./.tmp-node-resolve-loader.mjs ./scripts/manual-wallet-cli.js <command> [options]`). Extended during this effort to support fee/sign/announce/verify and the remaining services / tx types.
- **Node:** stock NIS testnet. Primary: `http://ntn1.dusanjp.com:7890` (reachable, height ~645509). Fallbacks in `DEFAULT_NODE_LIST`.
- **Accounts:** `TEST_WALLET_DATA.md` (testnet). Index 0 funded with ~1000 XEM. Send only between fixture accounts.
- **Multisig fixture (authorized):** convert testnet **index=4** to multisig with cosigners **index=0** and **index=2**. Irreversible on-chain.
- **API reference:** `nem-documentation.html` (NIS endpoints).

## Status legend

⬜ pending · ✅ pass · ❌ fail (see Bug log) · ⏭️ skipped/blocked · 🩹 passed after on-the-fly fix

## Conventions

- "Verify announced" = poll the account's confirmed history (`/account/transfers/all`, documented) for the tx hash, since `/transaction/get` is **not** in the NIS docs (see KI-1). Block time ≈ 60s, so allow ~1–3 min.
- A NEM transfer with fee `0` is rejected by the network, so every announce test must run `calculateTransactionFees` and apply the tier before signing.

---

## Remaining work (open — easiest → hardest)

Everything else passed or was fixed; only these remain. Details in the Bug log / Known issues below.

| Order | Item | Effort | What's needed |
|-------|------|--------|---------------|
| 1 | **BUG-9** — `decryptMessage` `isDecoded` guard | S | On a failed decrypt, return/throw a defined error instead of garbage. One-liner in `src/utils/transaction.js`. |
| 2 | **#23** — `NetworkService.fetchNodeList` | S | Decision/config, not a code defect: no NEM nodewatch service is configured, so it can't be exercised. Point `nodewatchURL` at a real NEM nodewatch, rely on the static node list, or drop the method. |
| 3 | **KI-1** — `/transaction/get` portability (`fetchAccountTransaction` / `fetchTransactionStatus`) | M | Endpoint is undocumented (works on some nodes, 404 on stock NIS). Reimplement via `/account/transfers/all?address=&hash=` + `/account/unconfirmedTransactions`; `fetchTransactionStatus` has no address → core-contract change. |

Fixed + validated on-chain (no action): BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-7, BUG-8.

## Test matrix

### P0 — core API + end-to-end transfer (must pass)

| # | Item | Service / unit | Effort | Status |
|---|------|----------------|--------|--------|
| 1 | Node resolve + ping | `NetworkService.pingNode` | S | ✅ |
| 2 | Network info/properties | `NetworkService.fetchNetworkInfo` | S | ✅ |
| 3 | Account info (funded) | `AccountService.fetchAccountInfo` | S | ✅ |
| 4 | Account info (not-found/unused) | `AccountService.fetchAccountInfo` 404 path | S | ⏭️ |
| 5 | Tx history — all/confirmed | `TransactionService.fetchAccountTransactions` | S | ✅ |
| 6 | Tx history — incoming/outgoing | same, `filter.direction` | S | ✅ |
| 7 | Tx history — unconfirmed | same, `group=unconfirmed` | S | ⬜ |
| 8 | **E2E transfer XEM** create→fee→sign→announce→verify | `TransferModule` + `signTransaction` + `announceTransaction` + history | L | ✅ |
| 9 | Announce path / error mapping | `TransactionService.announceTransaction(ToNode/Bundle)` | M | ✅ |

**E2E transfer — PASS (on-chain), `send-transfer` cmd:** `--index 0 --to <idx1> --amount 1 --message "e2e test" --wait` → create ✅ → fee calc+apply ✅ (`0.10` XEM = 0.05 transfer + 0.05 message-chunk, applied before signing) → sign ✅ → announce ✅ (NIS `{"code":1,"message":"SUCCESS"}`) → confirmed on-chain ✅ (hash `DCE8BF33…`). The fetched confirmed tx round-tripped the message model `{type:'plain', text:'e2e test', payload:'6532652074657374', native:{type:1}}`. BUG-2 + BUG-3 found+fixed en route. Also covers #11 (plain message) ✅.

**P0 read results (node `ntn1.dusanjp.com:7890`):**
- #1–3 ✅ — node resolves; `fetchNetworkInfo` returns testnet props (fees, rentalFees, networkTime, height); index 0 balance `1000`, fixture address/publicKey match. Confirms the `networkTypeToIdentifier` signed-byte fix end-to-end (node sends `-104` → `testnet`).
- #4 ⏭️ — NIS `/account/get` returns a graceful zero-account for any valid unused address (no 404), so the 404 branch isn't reachable for valid addresses; the not-found path is exercised by `fetchAccountInfo`'s try/catch only on transport 404. Acceptable.
- #5–6 ✅ — history returns the funding tx with the **new message model** decoded on-chain: `{type:'plain', text:'Good Luck!', payload:'476f6f64204c75636b21', native:{type:1}}`; transfer mosaic resolved `{nem.xem, amount:'1000', divisibility:6}`; incoming/outgoing filters correct.

### P1 — remaining services + common tx types

| # | Item | Service / unit | Effort | Status |
|---|------|----------------|--------|--------|
| 10 | Account balance | `AccountService.fetchAccountBalance` | S | ✅ |
| 11 | Transfer with plain message | `TransferModule` (message) | M | ✅ |
| 12 | Transfer with encrypted message + decrypt | `encryptMessage`/`getDecryptedMessageText` | M | ✅ (BUG-7,8) |
| 13 | Account mosaics | `MosaicService.fetchAccountMosaics` | M | 🩹 |
| 14 | Mosaic info(s) by id | `MosaicService.fetchMosaicInfo(s)` | M | ✅ |
| 15 | Multisig conversion (index=4) | `transaction-to-nem` multisig_account_modification + sign + announce | L | ✅ (after BUG-5) |
| 16 | Multisig info | `AccountService.fetchMultisigInfo` (post #15) | S | ✅ |
| 17 | Multisig transfer | `TransferModule` (senderPublicKey) + announce | L | ✅ |
| 18 | Cosignature | `cosignTransaction` + announce | L | ✅ |

**Multisig — PASS (on-chain), full flow.** Funded index 4 (10) + index 2 (2) from index 0.
- **#15** convert index 4 → multisig (cosigners 0,2; minApprovalDelta 2): first attempt **failed `FAILURE_FUTURE_DEADLINE`** → **BUG-5** (48h deadline > NEM's 24h max); after fix, confirmed (hash `415A5CF4…`, fee 0.5).
- **#16** index 4 → `{isMultisig:true, cosignatories:[idx0,idx2], minApproval:2}`; index 0 lists index 4 in `multisigAddresses`. ✅
- **#17** multisig transfer (inner signed by multisig idx4, wrapper signed by cosigner idx0 → idx1, 1 XEM): announce SUCCESS, inner hash from announce `innerTransactionHash`. *Built in the CLI because `TransferModule` can't produce it — **BUG-6**.
- **#18** cosign with idx2: announce SUCCESS → minApproval reached → **confirmed on-chain**: idx4 `9.5→8.15`, idx1 `1→2`; history shows type **4100** with `innerTx:257, amount:-1`. The **multisig account pays the cosignature fee** (idx2 unchanged at 2) — correct NEM behavior.
| 19 | Fetch tx by hash / status | `fetchAccountTransaction` / `fetchTransactionStatus` (`/transaction/get`) | S | ✅* |

### P2 — secondary services + remaining tx types

| # | Item | Service / unit | Effort | Status |
|---|------|----------------|--------|--------|
| 20 | Account namespaces | `NamespaceService.fetchAccountNamespaces` | S | ✅ |
| 21 | Namespace info(s) | `NamespaceService.fetchNamespaceInfo(s)` | M | ✅ |
| 22 | Market prices | `MarketService.fetchPrices` | S | ✅ |
| 23 | Node list (nodewatch) | `NetworkService.fetchNodeList` | S | ⏭️ |
| 24 | Listener (websocket) | `ListenerService` / `Listener` | L | ✅ (BUG-4 fixed) |
| 25 | Account key link (importance transfer) | `transaction-to-nem` account_key_link | M | ✅ |
| 26 | Namespace registration | `transaction-to-nem` namespace_registration | M | ✅ |
| 27 | Mosaic definition | `transaction-to-nem` mosaic_definition | M | ✅ |
| 28 | Mosaic supply change | `transaction-to-nem` mosaic_supply_change | M | ✅ |

**Other tx types — PASS (on-chain), all from index 0. No bugs found.**
- **#25** account key link / importance transfer (activate, fresh remote pubkey): SUCCESS + confirmed (`F5A3801D…`, fee 0.15). Accepted regardless of harvesting eligibility.
- **#26** namespace registration (root `claudeqa2316`, 100 XEM rental → sink `TAMESPACE…DJEYP35`): SUCCESS + confirmed (`D3C868B3…`, fee 0.15). `fetchAccountNamespaces`/`fetchNamespaceInfo` show index 0 owns it.
- **#27** mosaic definition (`claudeqa2316.token`, div 0, supply 1000, mutable, 10 XEM creation → sink `TBMOSAIC…BR5OLC`): SUCCESS + confirmed (`29072868…`, fee 0.15). `fetchMosaicInfo` resolves it.
- **#28** mosaic supply change (increase +500): SUCCESS + confirmed (`21D74EF9…`, fee 0.15). Index 0 now owns `claudeqa2316.token` = **1500** (1000 + 500), fully resolved — re-validates BUG-1.

**Encrypted message (#12) + BUG-6 — PASS (on-chain).**
- **#12** encrypted transfer idx0→idx2 (`secret hello`): SUCCESS + confirmed (`D8AA571A…`, fee 0.2). On-chain message `{type:'encrypted', text:null, payload:<64B>, native:{type:2}}`. Decrypt round-trip recovered `"secret hello"` from **both** the recipient (idx2) and the sender (idx0) via `getDecryptedMessageText`. Fixed **BUG-7** (encrypt) + **BUG-8** (decrypt) en route — both were dead code (no test, CLI previously stubbed).
- **BUG-6 fix validated**: a multisig transfer built through the corrected `TransferModule` (`senderPublicKey`=idx4) produced inner signer = idx4 and wrapper signer = idx0, announced, was cosigned by idx2, and confirmed (idx1 `2→3`, idx4 `8.15→6.8`).

---

## How to test (per item)

- **1–2 Network:** `account-info`/`overview` resolve a node (pingNode) and call `fetchNetworkInfo`; assert `networkIdentifier==='testnet'`, `networkCurrency`, `transactionFees`, `rentalFees`, `networkTime`, `chainHeight`.
- **3 Account info:** `account-info --index 0`; assert `balance≈1000`, `address`/`publicKey` match fixture, `mosaics` array, `isMultisig=false`.
- **4 Not-found:** `account-info` on a never-used address; assert graceful zero-balance object (no throw).
- **5–7 History:** `transactions --index 0 --group confirmed|unconfirmed --direction all|incoming|outgoing`; assert array shape, message `{type,text,payload,native}`, signed `amount`.
- **8 E2E transfer:** new `send-transfer` cmd: build via `TransferModule.createTransaction`, `calculateTransactionFees`, apply tier, `signTransaction`, `announceTransaction`, then poll history for the hash. Send small XEM index 0→1.
- **9 Announce:** observe success + force an error (bad payload) → assert `ApiError`.
- **10 Balance:** `fetchAccountBalance` equals account-info balance.
- **11–12 Messages:** `send-transfer --message` plain; `--message --encrypt` then `getDecryptedMessageText` round-trips.
- **13–14 Mosaics:** account with mosaics (or `nem:xem` via id) → divisibility/supply resolved.
- **15–18 Multisig:** `create-multisig` (index 4 + cosigners 0,2) → `fetchMultisigInfo` → `send-multisig-transfer` (initiator 0) → `cosign` (index 2).
- **19 By-hash:** fetch a known confirmed hash via `fetchAccountTransaction`/`fetchTransactionStatus` (tests `/transaction/get` on stock NIS — see KI-1).
- **20–23 Secondary:** namespaces of an owner; `nem` namespace info; market USD price; node list (needs nodewatch URL).
- **24 Listener:** open WS to `wsUrl`, subscribe confirmed/unconfirmed, announce a tx, assert callback.
- **25–28 Other tx types:** build descriptor via `transaction-to-nem`, sign, announce, verify; assert serialization + on-chain acceptance.

---

## Known issues / caveats (pre-identified)

- **KI-1 `/transaction/get` is undocumented but node-dependent.** `fetchAccountTransaction`/`fetchTransactionStatus` use `GET /transaction/get?hash=`, which is **absent from `nem-documentation.html`**. **Confirmed at runtime:** it returns HTTP 200 on `ntn1.dusanjp.com` (a common NIS extension), so #19 **passes** there. Residual risk: a stock NIS lacking this extension would 404 — keep the history-based (`/account/transfers/all`) verification as the portable fallback. (Flagged earlier with NOTE comments in `TransactionService`.)

## Secondary services — run results (node `ntn1.dusanjp.com:7890`)

| # | Service | Result | Evidence |
|---|---------|--------|----------|
| 10 | `fetchAccountBalance` | ✅ | `998.9` (1000 − 1.1 spent), matches account-info |
| 14 | `fetchMosaicInfo` / `fetchMosaicInfos` | ✅ | `company.token` → `{divisibility:0, supply:1000000, isSupplyMutable, isTransferable}`; native `nem.xem` correctly absent from the definition map (no on-chain def) |
| 19 | `fetchTransactionStatus` / `fetchAccountTransaction` | ✅* | status `confirmed`; full tx by hash with message + mosaics resolved, `amount:'-1'` (outgoing). *Relies on `/transaction/get` (KI-1). |
| 20 | `fetchAccountNamespaces` | ✅ | `[]` for index 0 (owns none) — graceful |
| 21 | `fetchNamespaceInfo` / `fetchNamespaceInfos` | ✅ | `company` → `{id,name,height,owner}`. Note: reserved `nem` namespace isn't returned by `/namespace?namespace=nem`; `fetchNamespaceInfos` silently omits it (per-id `catch`), which is acceptable |
| 22 | `fetchPrices` | ✅ | `{USD: 0.00056, requestTimestamp}` |
| 23 | `fetchNodeList` | ⏭️ | No NEM nodewatch URL configured/available; with empty base the URL is invalid (`Failed to parse URL`). The method is correct given a base URL — blocked on infra, not code |
| 24 | `Listener` | ✅ | Fixed (BUG-4): SockJS+STOMP on port 7778; live block + unconfirmed/confirmed tx pushes (hashes matched). |

---

## Bug log

_(filled during execution — id, item, severity, description, repro, decision)_

| ID | Item | Severity | Status | Summary |
|----|------|----------|--------|---------|
| BUG-1 | #13 `fetchAccountMosaics` | Medium | 🩹 fixed | Owned mosaics not *created by* the account — including the native `nem.xem` — came back unresolved (`amount:null, divisibility:null`) for every account. Root cause: definitions were fetched from `/account/mosaic/definition/page?address=` (mosaics the account **created**), so owned-but-not-created mosaics had no info; and `nem.xem` has **no** on-chain definition at all (`/namespace/mosaic/definition/page?namespace=nem` → `[]`). **Fix:** resolve owned ids via `fetchMosaicInfos` (namespace-scoped) and seed the native currency from `networkProperties.networkCurrency`. Verified: index 0 mosaics now `[{nem.xem, name:'XEM', divisibility:6, amount:'1000'}]`. Contained to `MosaicService`; on-the-fly fix. |

| BUG-2 | #9 `announceTransactionToNode` | High | 🩹 fixed | Announce sent the request body as a raw object (`body: signedTransaction.dto`) with no `JSON.stringify` and no `Content-Type`, so `fetch` posted `text/plain` → NIS `Content type 'text/plain;charset=UTF-8' not supported`. Symbol's equivalent stringifies + sets `application/json`. **Fix:** `body: JSON.stringify(signedTransaction.dto), headers: { 'Content-Type': 'application/json' }`. Blocks every announce. Contained to `TransactionService`; on-the-fly fix. |
| BUG-3 | #8 `signTransaction`/`cosignTransaction` | High | 🩹 fixed (on-chain ✅) | The announce `data` was built from `nemTransaction.serialize()` (the **verifiable** form), which emits an empty 64-byte signature field right after the signer public key. NIS parsed sequentially and read the recipient at the wrong offset → `expected value for property recipient`. The old NEM code skipped the SDK's `attachSignature` that **Symbol uses** ([symbol .../transaction.js:310](../symbol/src/utils/transaction.js#L310)); it must use the **non-verifiable** serialization. **Fix (approved):** build the dto via `facade.transactionFactory.constructor.attachSignature(tx, signature)` → `{ data: <non-verifiable hex>, signature }`; set `dto` as the announce body. Per your direction, also **dropped the NEM-only top-level `payload`** so `SignedTransaction`/`CosignedTransaction` match Symbol's `{ hash, dto }` (dto = what we announce). Cosign unit test now deserializes `dto.data` via `NonVerifiableCosignatureV1`. Validated on-chain (tx `DCE8BF33…` SUCCESS+confirmed). |
| BUG-4 | #24 `Listener` | Med–High | 🩹 fixed (on-chain ✅) | The NEM `Listener` implemented **Symbol's** WS protocol (uid/topic JSON), and `wsUrl` pointed at the REST port 7890. NEM NIS actually serves a **SockJS+STOMP** socket on a **separate port 7778** under `/w/messages` (the old `/w/messages/websocket` on 7890 closed with code 1006). **Fix:** (1) `wsUrl` now uses port 7778 + SockJS base `/w/messages` (new `NEM_WS_PORT` constant, in `constants` + `NetworkService`); (2) `Listener` rewritten to the SockJS transport framing (o/h/a/c) + STOMP `CONNECT`/`SUBSCRIBE` + the NIS `/w/api/account/subscribe` request, same public interface as Symbol/Ethereum. Validated on-chain: open handshake completes and live pushes arrive for new blocks and the account's unconfirmed→confirmed transactions (hashes matched). |
| BUG-5 | #15 `MULTISIG_TRANSACTION_DEADLINE_HOURS` | High | 🩹 fixed (on-chain ✅) | The constant was `48`, but NEM NIS rejects any transaction whose deadline is more than **24 hours** ahead → every multisig transaction (account modification + multisig transfer wrapper) failed at announce with `FAILURE_FUTURE_DEADLINE` (code 4). Single transfers (2h) were unaffected. **Fix:** `MULTISIG_TRANSACTION_DEADLINE_HOURS = 24` (NEM protocol max). After the fix the conversion + multisig transfer confirmed on-chain. Contained to `constants`; on-the-fly fix. |
| BUG-6 | #17 `TransferModule.createTransaction` (multisig) | Med | 🩹 fixed (on-chain ✅) | The multisig branch set **both** the inner transfer and the wrapper `signerPublicKey` to `currentAccount.publicKey`, so it could not produce a valid NEM multisig transfer (inner must be the multisig account, wrapper the initiating cosignatory). **Fix (Symbol-parity):** added `options.senderPublicKey` (the multisig account); the inner transfer is attributed to `senderPublicKey` and `isMultisig` is derived as `senderPublicKey !== currentAccount.publicKey`, with the wrapper signed by the current account. Validated on-chain: a module-built multisig transfer (inner signer = idx4, wrapper signer = idx0) announced, was cosigned by idx2, and confirmed (idx1 +1, idx4 −1.35). |
| BUG-7 | #12 `encryptMessage` | High | 🩹 fixed (on-chain ✅) | `messageEncoder.encodeDeprecated(...)` returns an SDK `Message { messageType, message }`, but the code ran `Buffer.from(encodedBytes)` on the whole object → `ERR_INVALID_ARG_TYPE: Received an instance of Message`. **Fix:** use `encoded.message` (the salt+IV+cipher `Uint8Array`). Never caught before — no unit test and the CLI previously stubbed encryption. Validated: encrypted transfer announced + confirmed. |
| BUG-8 | #12 `decryptMessage` | High | 🩹 fixed (on-chain ✅) | Called `messageEncoder.tryDecodeDeprecated(pubkey, bytes)` — that method does not exist (it is `tryDecode`) and it expects an SDK `Message { messageType: ENCRYPTED, message }`, not raw bytes. **Fix:** build the `Message` (`new models.Message()`, `messageType = MessageType.ENCRYPTED`, `message = encrypted bytes`) and call `tryDecode`. Validated: round-trip decrypt as both recipient and sender recovered "secret hello". |
| BUG-9 | #12 `decryptMessage` (hardening) | Low | ⛔ open | `tryDecode` returns `{ isDecoded, message }`; on a failed decrypt (wrong keys) `isDecoded` is `false` and `message` is the original encoded `Message`, so `Buffer.from(message)` would yield garbage instead of a clear error. The success path is correct (validated via BUG-8); add an `isDecoded` guard that throws a defined "cannot decrypt" error. Spotted while fixing BUG-8; no test failure. |

### BUG-4 detail
- **Repro:** `listen --index 0 --timeout 35000` → `openHandshakeCompleted:false`, events `[{event:'unsolicited-close', code:1006}, {event:'error'}]`. No block/tx events in the window.
- **Root cause:** `api/Listener.js` expects a `{ uid }` frame then `{ topic, data }` JSON frames (the Symbol listener protocol). NEM NIS speaks STOMP over SockJS, so the server closes the raw socket (1006) because no SockJS/STOMP handshake is performed.
- **Scope:** affects only real-time listening; all REST flows work.
- **Fixed:** `wsUrl` → `ws://host:7778/w/messages` (port 7778, new `NEM_WS_PORT`); `Listener` rewritten to SockJS transport framing + STOMP handshake/SUBSCRIBE + NIS account-subscribe. Verified on-chain via `listen`: `openHandshakeCompleted:true`, events `block`, `unconfirmed`, `confirmed` (tx hash `1b1b8525…` matched).

### BUG-3 detail
- **Evidence:** dry-run dump of a 1-XEM transfer → `data` is 188 bytes (a no-message v2 transfer should be ~120). Field decode: after the 32-byte signer key there is `40000000` (len 64) + 64 zero bytes (empty signature field) **before** the fee, so NIS reads `recipientLen=0`.
- **Root cause:** `utils/transaction.js` `signTransaction` (and `cosignTransaction`) set `dto.data = uint8ToHex(nemTransaction.serialize())`. `serialize()` is the verifiable form (includes the signature field); NIS announce expects the non-verifiable serialization.
- **Proposed fix (SDK-blessed):** after `facade.signTransaction(...)`, build the dto via `facade.transactionFactory.constructor.attachSignature(nemTransaction, signature)` (returns the `{data, signature}` JSON with non-verifiable `data`); set `payload = dto.data`. Apply in `signTransaction` and `cosignTransaction`. Re-verify the `cosignTransaction` test (it asserts `payload === dto.data` and deserializes `payload`).
- **Impact if applied:** unblocks #8 and every write/multisig/other-tx-type test below.

### BUG-1 detail
- **Repro (before):** `account-info --index 0` → `mosaics:[{id:'nem.xem', amount:null, absoluteAmount:1000000000, divisibility:null}]`.
- **Evidence:** `GET /account/mosaic/owned?address=` → `{"data":[{"quantity":1000000000,"mosaicId":{"namespaceId":"nem","name":"xem"}}]}`; `GET /namespace/mosaic/definition/page?namespace=nem` → `{"data":[]}`; `GET /account/mosaic/definition/page?address=` → `{"data":[]}`.
- **After:** `mosaics:[{id:'nem.xem', name:'XEM', divisibility:6, amount:'1000'}]`. Lint clean.
