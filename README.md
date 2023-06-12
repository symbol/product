# Symbol Product Monorepo

In Q1 2022, we consolidated a number of projects into this repository.
It includes our optin manager.

| component | lint | build | test | coverage | package |
|-----------|------|-------|------|----------| ------- |
| [@explorer/nodewatch](explorer/nodewatch) | [![lint][explorer-nodewatch-lint]][explorer-nodewatch-job] | | [![test][explorer-nodewatch-test]][explorer-nodewatch-job] | [![][explorer-nodewatch-cov]][explorer-nodewatch-cov-link]
| [@faucet/authenticator](faucet/authenticator) | [![lint][faucet-authenticator-lint]][faucet-authenticator-job] | | [![test][faucet-authenticator-test]][faucet-authenticator-job]| [![][faucet-authenticator-cov]][faucet-authenticator-cov-link] |
| [@faucet/backend](faucet/backend) | [![lint][faucet-backend-lint]][faucet-backend-job] | | [![test][faucet-backend-test]][faucet-backend-job]| [![][faucet-backend-cov]][faucet-backend-cov-link] |
| [@faucet/frontend](faucet/frontend) | [![lint][faucet-frontend-lint]][faucet-frontend-job] | [![build][faucet-frontend-build]][faucet-frontend-job] | [![test][faucet-frontend-test]][faucet-frontend-job]| [![][faucet-frontend-cov]][faucet-frontend-cov-link] |
| [@lightapi/python](lightapi/python) | [![lint][lightapi-python-lint]][lightapi-python-job] | | [![test][lightapi-python-test]][lightapi-python-job] | [![][lightapi-python-cov]][lightapi-python-cov-link]
| [@optin/puller](optin/puller) | [![lint][optin-puller-lint]][optin-puller-job] | | [![test][optin-puller-test]][optin-puller-job]| [![][optin-puller-cov]][optin-puller-cov-link] |
| [@optin/reporting](optin/reporting) | [![lint][optin-reporting-lint]][optin-reporting-job] | [![build][optin-reporting-build]][optin-reporting-job] | [![test][optin-reporting-test]][optin-reporting-job]| [![][optin-reporting-cov]][optin-reporting-cov-link] |
| [@tools/vanity](tools/vanity) | [![lint][tools-vanity-lint]][tools-vanity-job] | | [![test][tools-vanity-test]][tools-vanity-job]| [![][tools-vanity-cov]][tools-vanity-cov-link] |

## Full Coverage Report

Detailed version can be seen on [codecov.io][product-cov-link].

[![][product-cov]][product-cov-link]

[product-cov]: https://codecov.io/gh/symbol/product/branch/dev/graphs/tree.svg
[product-cov-link]: https://codecov.io/gh/symbol/product/tree/dev

[explorer-nodewatch-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch/activity?branch=dev
[explorer-nodewatch-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch%2Fdev%2F&config=explorer-nodewatch-lint
[explorer-nodewatch-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fexplorer-nodewatch%2Fdev%2F&config=explorer-nodewatch-test
[explorer-nodewatch-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=explorer-nodewatch
[explorer-nodewatch-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/explorer/nodewatch

[faucet-authenticator-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator/activity?branch=dev
[faucet-authenticator-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator%2Fdev%2F&config=faucet-authenticator-lint
[faucet-authenticator-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-authenticator%2Fdev%2F&config=faucet-authenticator-test
[faucet-authenticator-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-authenticator
[faucet-authenticator-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/authenticator

[faucet-backend-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend/activity?branch=dev
[faucet-backend-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend%2Fdev%2F&config=faucet-backend-lint
[faucet-backend-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-backend%2Fdev%2F&config=faucet-backend-test
[faucet-backend-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-backend
[faucet-backend-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/backend

[faucet-frontend-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend/activity?branch=dev
[faucet-frontend-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-lint
[faucet-frontend-build]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-build
[faucet-frontend-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ffaucet-frontend%2Fdev%2F&config=faucet-frontend-test
[faucet-frontend-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=faucet-frontend
[faucet-frontend-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/faucet/frontend

[lightapi-python-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Flightapi-python/activity?branch=dev
[lightapi-python-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Flightapi-python%2Fdev%2F&config=lightapi-python-lint
[lightapi-python-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Flightapi-python%2Fdev%2F&config=lightapi-python-test
[lightapi-python-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=lightapi-python
[lightapi-python-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/lightapi/python

[optin-puller-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Foptin-puller/activity?branch=dev
[optin-puller-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Foptin-puller%2Fdev%2F&config=optin-puller-lint
[optin-puller-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Foptin-puller%2Fdev%2F&config=optin-puller-test
[optin-puller-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=optin-puller
[optin-puller-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/optin/puller

[optin-reporting-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Foptin-reporting/activity?branch=dev
[optin-reporting-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Foptin-reporting%2Fdev%2F&config=optin-reporting-lint
[optin-reporting-build]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Foptin-reporting%2Fdev%2F&config=optin-reporting-build
[optin-reporting-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Foptin-reporting%2Fdev%2F&config=optin-reporting-test
[optin-reporting-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=optin-reporting
[optin-reporting-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/optin/reporting

[tools-vanity-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Ftools-vanity/activity?branch=dev
[tools-vanity-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-vanity%2Fdev%2F&config=tools-vanity-lint
[tools-vanity-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Ftools-vanity%2Fdev%2F&config=tools-vanity-test
[tools-vanity-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=tools-vanity
[tools-vanity-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/tools/vanity
