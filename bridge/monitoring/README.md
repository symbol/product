# Monitoring

The bridge API exposes Prometheus metrics on `/metrics`. This directory holds the part of a
monitoring setup that belongs to the bridge itself: the alert rules, which break when a metric is
renamed and so are versioned next to the code that publishes it.

Deployment specific configuration is deliberately **not** here: `prometheus.yml`, the Alertmanager
routing and any credentials describe one installation, not the product.

## Scraping

```yaml
scrape_configs:
  - job_name: bridge
    metrics_path: /metrics
    static_configs:
      - targets: ['10.0.0.10:5000']
        labels:
          bridge: mainnet-ethereum-wrapped
```

Four things worth knowing before pointing Prometheus at a bridge:

* `/metrics` is unauthenticated and reports node endpoints, the vault URL and bridge account
  addresses. It should not be reachable from the public internet; scrape it over a private network.
* Every scrape reads the nodes, the price oracle and the vault live. A scrape interval below
  roughly 30 seconds turns monitoring into production traffic.
* `scrape_timeout` has to exceed the collector timeouts. Each read is given 3 seconds by default
  and the vault collector performs two of them in sequence, so 10-15 seconds is a safe value.

The `bridge` label above is what scopes an alert to one instance when several bridges are scraped by
the same Prometheus. It is not optional: rules that combine two metrics pair their series on it
(`on (bridge)`, `on (bridge, network)`), so a missing label pairs every bridge with every other.

## Alert rules

`rules/bridge.yml` is organised by what the responder does with an alert rather than by which
component produced it:

| Group | Contains | Severity |
|---|---|---|
| `bridge-symptoms` | what users feel: requests lost, payouts not confirming, deposits not processing | pages |
| `bridge-causes` | why it happens: vault, oracle, nodes, chain progress, download progress, expiring token | mostly pages, some tickets |
| `bridge-capacity` | balances running out; **thresholds are placeholders, set them per deployment** | pages |

Point Prometheus at it:

```yaml
rule_files:
  - /etc/prometheus/rules/bridge.yml
```

The tests live outside `rules/` on purpose: Prometheus loads everything a `rule_files` glob
matches, and a unit test file is not a rule file.

Validate and test before reloading:

```sh
promtool check rules rules/bridge.yml
promtool test rules tests/bridge_test.yml
```

`tests/bridge_test.yml` runs the rules against synthetic series: a node that never answers, one
that answers a fifth of the time, a chain that stops advancing, a single permanently failed request,
a swap bridge whose native balance must stay quiet, a request downloader that stops while the chain
keeps finalizing, and one ETH balance that has to reach a different rule depending on the mode the
bridge reports. It is worth running in CI, since a rename of a metric or a change to a hold period
shows up as a failing test rather than as an alert that quietly never fires again.

## Runbooks

### BridgeRequestsFailedPermanently

A request failed and was not retried, so no automation will pick it up again. Check the request in
the wrap or unwrap database on the bridge host, establish whether funds were taken and not paid out,
and decide on a manual payout. This is the one alert here that needs a person rather than a restart.

It fires on failures that appeared in the last twelve hours rather than on the standing count, so a
request that is examined and deliberately left alone stops notifying instead of firing forever. The
next failure still pages, which a permanent silence would have prevented. The window is long enough
to survive a night, which is also why it needs its own `repeat_interval` in Alertmanager:

```yaml
    - matchers: [alertname="BridgeRequestsFailedPermanently"]
      receiver: <the channel that pages>
      repeat_interval: 3h
```

Without it, a twelve hour window at the usual hourly repeat sends a dozen reminders about one
failure. The consequence of the window is that a resolved notification only means no new failures
arrived; query `bridge_requests_failed_permanent` itself to see what is still outstanding.

### BridgePayoutsNotConfirming

A payout was announced but is not being confirmed. Check whether the payout network is producing
blocks (`blockchain_height`) and finalizing them (`blockchain_finalized_height`), then whether the
fee it was sent with is still competitive. On Ethereum a spike in base fee can leave transactions
pending indefinitely.

**The threshold follows the payout network.** A payout stays in `SENT` until
`check_finalized_transactions` sees it *finalized*, not merely included, so this alert measures
finalization latency as much as it measures trouble. Wrapping pays out on the wrapped leg and
unwrapping on the native one.

One hour suits Ethereum (~13 minutes to finality) and Symbol (one finalization epoch). NEM is the
open question: lightapi currently reports its finalized height as a fixed 360 blocks behind the
chain, which at a one minute block time would be about six hours and would page on every healthy
payout. Until that behaviour is settled, a bridge with a NEM payout leg needs this threshold raised
by hand.

### BridgeDepositsNotProcessing

Deposits are arriving but not being paid out, so users see their funds accepted and nothing sent
back. Check that the workflow container is running; it is separate from the API, so `/metrics` can
be perfectly healthy while nothing is processed. Then check finalization on the deposit leg, since
deposits are only acted on once finalized.

### BridgeVaultUnavailable

Most often the vault came up sealed after a restart; unseal it. Otherwise check reachability and
whether it is in standby. The metric's zero covers unreachable, sealed, standby and uninitialized
alike, so it does not tell you which of them you are looking at. Nothing is signed until this
clears, so both legs stop paying out.

### BridgePriceOracleUnavailable

Check whether the provider is up and whether the monthly quota is exhausted
(`bridge_price_oracle_credits_left`). The conversion rate is fetched before the queue is read, so
payouts stop entirely while this lasts. The probe is cached for five minutes and that cache lives in
one gunicorn worker, which is why the rule waits fifteen minutes rather than firing on a flap.

### BridgeNodeUnavailable

The bridge could not read its balance from this node, so on this leg it can neither see new
deposits nor pay out. Check the node itself, its certificate and anything in front of it. The
`endpoint` label names the exact URL from configuration.

### BridgeNodeUnreliable

The node answers intermittently. Look at `avg_over_time(bridge_node_up[6h])` for the shape of it,
then at the node's own logs, since an overloaded or partially synced node behaves this way. It
delays deposits and makes payouts retry needlessly, without ever tripping `BridgeNodeUnavailable`,
whose `for` window is reset by every successful read.

### BridgeChainStalled

The node answers but reports no new blocks, so nothing the bridge does on this leg can complete,
and unlike an unreachable node, this looks healthy from the outside. Compare its height against a
public explorer to tell a stuck node from a stalled network.

### BridgeFinalizationStalled

Blocks are produced but not finalized, so deposits are not acted on. On Symbol check finalization
participation; on NEM this rule tracks the chain itself, since there is no real finalization.

### BridgeRequestDownloadStalled

The downloader for this leg has stopped reading blocks while the chain kept finalizing them, so
deposits arriving now will not become requests at all. Check the flow container: it runs the
workflows in a loop and exits on the first error, so a failure that repeats leaves it restarting and
the height frozen. `bridge_processed_height` is the marker the downloader writes after every scan,
whether or not the range held any requests, which is why it separates a dead downloader from a
bridge nobody is using. The request metrics cannot, since both look like zeros.

Requests are downloaded from the network opposite the one they are paid out on, so
`network="native"` is the wrap downloader and `network="wrapped"` the unwrap one. Compare
`bridge_processed_height` against `blockchain_finalized_height` on that leg to see how far behind it
is; the rule itself turns on movement rather than on the size of the gap, since a
`finalization_lookahead` puts the downloader ahead of finalization and makes the gap negative.

Two things the rule deliberately does not fire on. The first is a height of zero, which means a
downloader that never ran at all: swap mode has no unwrap leg, and `nativeflow` never invokes it.
The second is a chain that is not finalizing, which is `BridgeFinalizationStalled` and would
otherwise page twice.

### BridgeVaultTokenExpiring

Rotate the vault access token and update the bridge configuration. Nothing renews it automatically,
so this is a deadline, not a failure.

### BridgePriceOracleQuotaLow

The monthly quota is running out, and it is a silent countdown: when it reaches zero the oracle
starts failing and payouts stop. Either raise the plan or reduce how often the oracle is asked,
remembering that every scrape of a bridge with several gunicorn workers can probe the provider once
per worker. Only providers that report a quota publish this metric, so on the others the rule has
nothing to read and stays silent.

### BridgeWrappedBalanceLow

Top up the bridge account on the wrapped network. This is the float wrap payouts come out of; it is
pre-funded by hand rather than minted, so a stretch of one-way traffic drains it.

### BridgeEthereumGasLow

Top up the ETH balance. This is the wrap and stake version of the rule, where ETH only pays
transaction fees, since payouts leave as an ERC-20 that `BridgeWrappedBalanceLow` watches. A
threshold sized for a few days of gas is enough.

It excludes swap bridges by their own `bridge_info{mode="swap"}`, and a bridge that reports no mode
still gets this rule: of the two, it is the one that alerts rather than the one that stays quiet.

### BridgeEthereumPayoutBalanceLow

Top up the ETH balance, and treat it as a payout float rather than as gas. This is the swap version
of the rule: the account pays out ETH *and* pays the gas for doing so, so one threshold covers both,
and being sized for the float it always trips before gas becomes the problem.

Size it from `maxDailyTransferAmount` on the Ethereum leg rather than from gas. An exhausted balance
is treated as a transient error and retried indefinitely rather than failed, so nothing pages on its
own until `BridgeDepositsNotProcessing` notices the deposit age an hour later. The threshold is
what buys the time to top up before that.

### BridgeNativeBalanceLow

Top up the bridge account on the native network. It funds unwrap payouts and their fees. Bridges in
swap mode are excluded automatically, because the rule filters on `bridge_info{mode="swap"}`, which
the bridge reports about itself, so nobody has to remember to delete this rule for such a
deployment.

### Which capacity alerts apply

Payouts always come from the account on the network they land on, and those accounts are pre-funded
by hand. The wrapped supply is backed by deposits on the other leg, but that backing does not move
funds for you.

| Mode | Pays out on | Alerts that apply |
|---|---|---|
| Wrap, stake | wrapped leg (wrap), native leg (unwrap) | `BridgeWrappedBalanceLow` for the ERC-20 float, `BridgeEthereumGasLow` for the gas behind it, `BridgeNativeBalanceLow` for unwrap payouts and their fees |
| Swap | wrapped leg only | `BridgeEthereumPayoutBalanceLow` alone. The ERC-20 rule matches nothing, since that leg moves ETH itself, and the native rule excludes itself: the native account only receives |

Which of the two ETH rules a bridge gets is decided by the bridge itself, from the `mode` it
reports in `bridge_info`, so both can be deployed everywhere and neither has to be edited out by
hand for a particular instance.

The thresholds and divisors shipped here are placeholders. Set them from daily volume and from the
divisibility of the assets involved: 1e18 for ETH and 18 decimal ERC-20 tokens, 1e6 for XYM, XEM and
the wrapped mosaic.
