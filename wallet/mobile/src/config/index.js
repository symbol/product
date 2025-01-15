import configFile from './config.json';
import knownAccountsFile from './knownAccounts.json';
import optInWhiteListFile from './optInWhiteList.json';
import termsAndPrivacyFile from './termsAndPrivacy.json';

export const knownAccounts = knownAccountsFile;
export const optInWhiteList = optInWhiteListFile;
export const termsAndPrivacy = termsAndPrivacyFile;
export const config = {
    nodeProbeTimeout: configFile.nodeProbeTimeout,
    defaultNodes: configFile.defaultNodes,
    statisticsServiceURL: configFile.statisticsServiceURL,
    explorerURL: configFile.explorerURL,
    faucetURL: configFile.faucetURL,
    discordURL: configFile.discordURL,
    githubURL: configFile.githubURL,
    twitterURL: configFile.twitterURL,
    marketDataURL: configFile.marketDataURL,
    marketCurrencies: configFile.marketCurrencies,
    optInPayoutSigner: configFile.optInPayoutSigner,
    networkIdentifiers: configFile.networkIdentifiers,
    defaultNetworkIdentifier: configFile.defaultNetworkIdentifier,
    maxSeedAccounts: configFile.maxSeedAccounts,
    connectionInterval: configFile.connectionInterval,
    allowedMarkedDataCallInterval: configFile.allowedMarkedDataCallInterval,
};
