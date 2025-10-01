# Symbol Product Monorepo

In Q1 2022, we consolidated a number of projects into this repository.
It includes our optin manager.

| component | lint | build | test | coverage | package |
|-----------|------|-------|------|----------| ------- |
| [@bridge](bridge) | [![lint][bridge-lint]][bridge-job] | | [![test][bridge-test]][bridge-job] | [![][bridge-cov]][bridge-cov-link]
| [@explorer/frontend](explorer/frontend) | [![lint][explorer-frontend-lint]][explorer-frontend-job] | | [![test][explorer-frontend-test]][explorer-frontend-job] | [![][explorer-frontend-cov]][explorer-frontend-cov-link]
| [@explorer/nodewatch](explorer/nodewatch) | [![lint][explorer-nodewatch-lint]][explorer-nodewatch-job] | | [![test][explorer-nodewatch-test]][explorer-nodewatch-job] | [![][explorer-nodewatch-cov]][explorer-nodewatch-cov-link]
| [@explorer/rest](explorer/rest) | [![lint][explorer-rest-lint]][explorer-rest-job] | | [![test][explorer-rest-test]][explorer-rest-job] | [![][explorer-rest-cov]][explorer-rest-cov-link]
| [@faucet/authenticator](faucet/authenticator) | [![lint][faucet-authenticator-lint]][faucet-authenticator-job] | | [![test][faucet-authenticator-test]][faucet-authenticator-job]| [![][faucet-authenticator-cov]][faucet-authenticator-cov-link] |
| [@faucet/backend](faucet/backend) | [![lint][faucet-backend-lint]][faucet-backend-job] | | [![test][faucet-backend-test]][faucet-backend-job]| [![][faucet-backend-cov]][faucet-backend-cov-link] |
| [@faucet/frontend](faucet/frontend) | [![lint][faucet-frontend-lint]][faucet-frontend-job] | [![build][faucet-frontend-build]][faucet-frontend-job] | [![test][faucet-frontend-test]][faucet-frontend-job]| [![][faucet-frontend-cov]][faucet-frontend-cov-link] |
| [@lightapi/python](lightapi/python) | [![lint][lightapi-python-lint]][lightapi-python-job] | | [![test][lightapi-python-test]][lightapi-python-job] | [![][lightapi-python-cov]][lightapi-python-cov-link]
| [@tools/shoestring](tools/shoestring) | [![lint][tools-shoestring-lint]][tools-shoestring-job] | | [![test][tools-shoestring-test]][tools-shoestring-job]| [![][tools-shoestring-cov]][tools-shoestring-cov-link] |
| [@tools/vanity](tools/vanity) | [![lint][tools-vanity-lint]][tools-vanity-job] | | [![test][tools-vanity-test]][tools-vanity-job]| [![][tools-vanity-cov]][tools-vanity-cov-link] |
| [@wallet/common-core](wallet/common/core) | [![lint][wallet-common-core-lint]][wallet-common-core-job] | | [![test][wallet-common-core-test]][wallet-common-core-job]| [![][wallet-common-core-cov]][wallet-common-core-cov-link] |
| [@wallet/common-symbol](wallet/common/symbol) | [![lint][wallet-common-symbol-lint]][wallet-common-symbol-job] | | [![test][wallet-common-symbol-test]][wallet-common-symbol-job]| [![][wallet-common-symbol-cov]][wallet-common-symbol-cov-link] |

## Full Coverage Report

Detailed version can be seen on [codecov.io][product-cov-link].

[![][product-cov]][product-cov-link]

[product-cov]: https://codecov.io/gh/symbol/product/branch/dev/graphs/tree.svg
[product-cov-link]: https://codecov.io/gh/symbol/product/tree/dev

[bridge-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fbridge/activity?branch=dev
[bridge-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fbridge%2Fdev%2F&config=bridge-lint
[bridge-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fbridge%2Fdev%2F&config=bridge-test
[bridge-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=bridge
[bridge-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/bridge

[explorer-frontend-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fexplorer-frontend/activity?branch=dev
[explorer-frontend-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-frontend%2Fdev%2F&config=explorer-frontend-lint
[explorer-frontend-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-frontend%2Fdev%2F&config=explorer-frontend-test
[explorer-frontend-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=explorer-frontend
[explorer-frontend-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/explorer/frontend

[explorer-nodewatch-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch/activity?branch=dev
[explorer-nodewatch-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch%2Fdev%2F&config=explorer-nodewatch-lint
[explorer-nodewatch-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch%2Fdev%2F&config=explorer-nodewatch-test
[explorer-nodewatch-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=explorer-nodewatch
[explorer-nodewatch-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/explorer/nodewatch

[explorer-rest-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fexplorer-rest/activity?branch=dev
[explorer-rest-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-rest%2Fdev%2F&config=explorer-rest-lint
[explorer-rest-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-rest%2Fdev%2F&config=explorer-rest-test
[explorer-rest-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=explorer-rest
[explorer-rest-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/explorer/rest

[faucet-authenticator-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator/activity?branch=dev
[faucet-authenticator-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator%2Fdev%2F&config=faucet-authenticator-lint
[faucet-authenticator-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator%2Fdev%2F&config=faucet-authenticator-test
[faucet-authenticator-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-authenticator
[faucet-authenticator-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/authenticator

[faucet-backend-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend/activity?branch=dev
[faucet-backend-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend%2Fdev%2F&config=faucet-backend-lint
[faucet-backend-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend%2Fdev%2F&config=faucet-backend-test
[faucet-backend-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-backend
[faucet-backend-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/backend

[faucet-frontend-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend/activity?branch=dev
[faucet-frontend-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-lint
[faucet-frontend-build]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-build
[faucet-frontend-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-test
[faucet-frontend-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-frontend
[faucet-frontend-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/frontend

[lightapi-python-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Flightapi-python/activity?branch=dev
[lightapi-python-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Flightapi-python%2Fdev%2F&config=lightapi-python-lint
[lightapi-python-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Flightapi-python%2Fdev%2F&config=lightapi-python-test
[lightapi-python-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=lightapi-python
[lightapi-python-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/lightapi/python

[tools-shoestring-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ftools-shoestring/activity?branch=dev
[tools-shoestring-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-shoestring%2Fdev%2F&config=tools-shoestring-lint
[tools-shoestring-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-shoestring%2Fdev%2F&config=tools-shoestring-test
[tools-shoestring-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=tools-shoestring
[tools-shoestring-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/tools/shoestring

[tools-vanity-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ftools-vanity/activity?branch=dev
[tools-vanity-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-vanity%2Fdev%2F&config=tools-vanity-lint
[tools-vanity-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-vanity%2Fdev%2F&config=tools-vanity-test
[tools-vanity-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=tools-vanity
[tools-vanity-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/tools/vanity

[wallet-common-core-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fwallet-common-core/activity?branch=dev
[wallet-common-core-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fwallet-common-core%2Fdev%2F&config=wallet-common-core-lint
[wallet-common-core-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fwallet-common-core%2Fdev%2F&config=wallet-common-core-test
[wallet-common-core-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=wallet-common-core
[wallet-common-core-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/wallet/common/core

[wallet-common-symbol-job]: https://jenkins.symbolsyndicate.us/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fwallet-common-symbol/activity?branch=dev
[wallet-common-symbol-lint]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fwallet-common-symbol%2Fdev%2F&config=wallet-common-symbol-lint
[wallet-common-symbol-test]: https://jenkins.symbolsyndicate.us/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fwallet-common-symbol%2Fdev%2F&config=wallet-common-symbol-test
[wallet-common-symbol-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=wallet-common-symbol
[wallet-common-symbol-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/wallet/common/symbol
