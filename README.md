# Symbol Product Monorepo

In Q1 2022, we consolidated a number of projects into this repository.
It includes our optin manager.

| component | lint | build | test | coverage | package |
|-----------|------|-------|------|----------| ------- |
| [@optin/puller](optin/puller) | [![lint][optin-puller-lint]][optin-puller-job] || [![test][optin-puller-test]][optin-puller-job]| [![][optin-puller-cov]][optin-puller-cov-link] |
| [@optin/reporting](optin/reporting) | [![lint][optin-reporting-lint]][optin-reporting-job] || [![test][optin-reporting-test]][optin-reporting-job]| [![][optin-reporting-cov]][optin-reporting-cov-link] |
| [@tools/vanity](tools/vanity) | [![lint][tools-vanity-lint]][tools-vanity-job] || [![test][tools-vanity-test]][tools-vanity-job]| [![][tools-vanity-cov]][tools-vanity-cov-link] |
| [@explorer/nodewatch](explorer/nodewatch) | [![lint][explorer-nodewatch-lint]][explorer-nodewatch-job] ||||

## Full Coverage Report

Detailed version can be seen on [codecov.io][product-cov-link].

[![][product-cov]][product-cov-link]

[product-cov]: https://codecov.io/gh/symbol/product/branch/dev/graphs/tree.svg
[product-cov-link]: https://codecov.io/gh/symbol/product/tree/dev

[optin-puller-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fpuller/activity?branch=dev
[optin-puller-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fpuller%2Fdev%2F&config=optin-puller-lint
[optin-puller-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fpuller%2Fdev%2F&config=optin-puller-test
[optin-puller-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=optin-puller
[optin-puller-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/optin/puller

[optin-reporting-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Freporting/activity?branch=dev
[optin-reporting-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Freporting%2Fdev%2F&config=optin-reporting-lint
[optin-reporting-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Freporting%2Fdev%2F&config=optin-reporting-test
[optin-reporting-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=optin-reporting
[optin-reporting-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/optin/reporting

[tools-vanity-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fvanity/activity?branch=dev
[tools-vanity-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fvanity%2Fdev%2F&config=tools-vanity-lint
[tools-vanity-test]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fvanity%2Fdev%2F&config=tools-vanity-test
[tools-vanity-cov]: https://codecov.io/gh/symbol/product/branch/dev/graph/badge.svg?token=SSYYBMK0M7&flag=tools-vanity
[tools-vanity-cov-link]: https://codecov.io/gh/symbol/product/tree/dev/tools/vanity

[explorer-nodewatch-job]: https://jenkins.symboldev.com/blue/organizations/jenkins/Symbol%2Fgenerated%2Fproduct%2Fnodewatch/activity?branch=dev
[explorer-nodewatch-lint]: https://jenkins.symboldev.com/buildStatus/icon?job=Symbol%2Fgenerated%2Fproduct%2Fnodewatch%2Fdev%2F&config=explorer-nodewatch-lint
