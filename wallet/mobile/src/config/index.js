import configFile from './config.json';

export * from './constants';

export const config = {
    nodeProbeTimeout: configFile.nodeProbeTimeout,
    defaultNodes: configFile.defaultNodes,
    statisticsServiceURL: configFile.statisticsServiceURL,
    explorerURL: configFile.explorerURL,
    faucetURL: configFile.faucetURL,
    discordURL: configFile.discordURL,
    githubURL: configFile.githubURL,
    twitterURL: configFile.twitterURL,
    optInPayoutSigner: configFile.optInPayoutSigner,
    networkIdentifiers: configFile.networkIdentifiers,
    defaultNetworkIdentifier: configFile.defaultNetworkIdentifier,
    maxSeedAccounts: configFile.maxSeedAccounts
};
