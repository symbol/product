# Public Symbol chain commitments

`public_chain_commitments.json` contains selected public REST DTOs retrieved on
2026-11-20 UTC using read-only HTTPS requests. The tests run offline. The
`networks` entries record the REST origin and the observed `/node/info` and
`/chain/info` responses.

| Network | REST origin | Node public key |
| --- | --- | --- |
| Mainnet (104) | [NEMTUS](https://symbol-main-1.nemtus.com:3001/node/info) | `B56A3C73CA345A00CDDC84CFDF711CD67B2CCE10BEB82CB74835086774FE587F` |
| Testnet (152) | [001-sai-dual](https://001-sai-dual.symboltest.net:3001/node/info) | `31143029EB7415B7C45EDD9A05C28C4BD28EE16CF5127617AC7302E05219A55A` |

Each transaction case records the source paths, selected original transaction
DTO, any separate embedded DTOs, block DTO, and Merkle proof. The node-supplied
`meta.hash`, `meta.merkleComponentHash`, `block.transactionsHash` and path
provide the expected values. A stable lookup uses
`/transactions/confirmed/{meta.hash}` on the recorded network. Aggregate rows
came from height-constrained `embedded=true` pages, as in the Puller replay
query. The proof endpoint uses `meta.merkleComponentHash` as the leaf,
including for cosigned aggregates. Empty proof paths apply to single-transaction
blocks. [Symbol REST specification](https://github.com/symbol/symbol-openapi) ·
[Symbol transaction inclusion guide](https://docs.symboltest.net/en/devbook/chain/prove-transaction/)

The fixtures cover the requested transaction families. Symbol requires Account
Metadata, Mosaic Metadata, Namespace Metadata, and Multisig Account
Modification to be embedded in an aggregate. Top-level type searches on the
testnet node returned empty pages for all four types, and the equivalent mainnet
requests timed out. Each has a real V3 parent and an embedded DTO. Some testnet
samples were confirmed above the finalized height reported in the recorded
`/chain/info` response. [Metadata permissions](https://docs.symbol.dev/concepts/metadata.html#permissions) ·
[Symbol multisig configuration](https://docs.symboltest.net/en/devbook/accounts/configure-multisig/)

The Aggregate Complete V1 at mainnet height 94 and V2 at 4,759,093 provide
entity and component verification with unbound embedded payloads. The smaller
V1 at height 421 and V2 at 4,759,026 have verified embedded payloads. All three
Bonded versions include cosignatures. [Catapult aggregate hash validator](https://github.com/symbol/symbol/blob/b3222548d6c8/client/catapult/plugins/txes/aggregate/src/validators/AggregateTransactionsHashValidator.cpp) ·
[Symbol Syndicate aggregate V3 post-mortem](https://thesymbolsyndicate.notion.site/post-mortem-october-25)

Receipt fixtures contain complete REST statement pages and the node-supplied
`block.receiptsHash`. They include mainnet heights 5,969,019 and 5,966,484
(the latter contains a Hash Lock receipt), plus testnet height 3,125,903 with
both address and mosaic resolution statements. [Symbol blocks and receipt commitments](https://docs.symboltest.net/en/textbook/blocks/) ·
[Source transaction for the resolution example](https://docs.symboltest.net/en/devbook/namespaces/resolve-namespace-from-receipt/)
