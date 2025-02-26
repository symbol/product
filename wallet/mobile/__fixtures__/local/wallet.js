export const mnemonic =
    'valve blossom bright away room lady assume always oven belt family when pride wild sort earn bicycle galaxy practice drink rely divide puzzle dune';

export const walletStorageAccounts = {
    mainnet: [
        {
            address: 'NALSBRWZTK3WQEGZ25NO4YH2MOU4SXYY6AVY72I',
            publicKey: 'A55C641506CE1A9E097A551DF9B6FC5C58AC9C22E6B0368EBAED0184CD9ADDAB',
            name: 'My Account',
            networkIdentifier: 'mainnet',
            accountType: 'seed',
            index: 0,
            privateKey: '1793A85E07C164F8C48D33B291F50FA140DC50114BBEADBC8F48143D4AE08764',
        },
        {
            address: 'NCSMSP2GSGWM5DHLJV5QXK4447UTCRK2EPKLWSA',
            publicKey: 'F94C017383A5FE74B5AB56B9EA09534E9C7F4DF299A80428C883B8124B60B710',
            name: 'Seed Account 1',
            networkIdentifier: 'mainnet',
            accountType: 'seed',
            index: 1,
            privateKey: '88BD0C5BDFD361FB4D8CB3D78FECE2ACFEACF7A820F6C78A2F2D62EF83DE68D3',
        },
        {
            address: 'NCDXMQJJKZGTZI2RNIIAFP7FX5KR6OSMKJTGHBI',
            publicKey: '103054F3037D759E52DCD6D61440846D57B1FAFEB10B5D7EF8F9D3EF85D82178',
            name: 'Seed Account 2',
            networkIdentifier: 'mainnet',
            accountType: 'seed',
            index: 2,
            privateKey: '013117504BD8D5CEF95E0FE26FF2E7F4680E73F6C6C6B7428DBF28E2E0567D75',
        },
        {
            address: 'NAZXZH36SF2QNWJN7MNES62VYSEJPDM5WO5HAIY',
            publicKey: 'A0780ABAD74684FA00EAAF8A5000DBC31051FCAB701C37954D392DDB8FD99BF1',
            name: 'Seed Account 3',
            networkIdentifier: 'mainnet',
            accountType: 'seed',
            index: 3,
            privateKey: '1D06ECB21234BF332A8A13D7E1FAE546D1DCD1DBF6BAACCE7D0822E86D70671B',
        },
        {
            address: 'NCUAUEAQ6VZISAJCQETXJCX7XZMDGCNK3GFUJXA',
            publicKey: 'F7465556B72820C2077DD4AF11671A3CDE60F29E08B6453522D8220278F3CB1E',
            name: 'Seed Account 4',
            networkIdentifier: 'mainnet',
            accountType: 'seed',
            index: 4,
            privateKey: 'F57D3403397DCCAFFA4454D6970AD72B21BC7E3FD33FA9B3F8D9D42A1CF35512',
        },
    ],
    testnet: [
        {
            address: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
            publicKey: 'F9214C919AB21E14385107FE17E1BE6B95D8598C8BD1413B951D65D76ABA1A6C',
            name: 'My Account',
            networkIdentifier: 'testnet',
            accountType: 'seed',
            index: 0,
            privateKey: '40C56A968FB0E551966FD958055EB6634D3AC0372745AFF442460FF20FA13202',
        },
        {
            address: 'TBKF2QMUL6S6JWLBCN7PV2NADPUMCQEUJ7YEMAQ',
            publicKey: '31A07A8579DAE809099D692B2B97C1693F2AF867C90FE7A2B14AB49E036344E6',
            name: 'Seed Account 1',
            networkIdentifier: 'testnet',
            accountType: 'seed',
            index: 1,
            privateKey: '69D82A26D2DBABF721F012A6210E7E07BA2792A47B3AB3FE4D6C1EEC488E912E',
        },
        {
            address: 'TCKJ7VYDVJELN5PCMYAEOHFKQ5IZ7VSSZVHZLDA',
            publicKey: '3D6BA28FED58F8A9FFB0DDCB0E4F25F81F9255515AAFCC0626684D8D9D46FADB',
            name: 'Seed Account 2',
            networkIdentifier: 'testnet',
            accountType: 'seed',
            index: 2,
            privateKey: '17AB3DE0B72A5AF06396BE4AF47FDFA414DE2C519409D60728C70AB2520B461C',
        },
        {
            address: 'TAP55APXFTWDROHUZLL5GRBBFVSNTHDAGCYTANA',
            publicKey: '26BB5F23FAE6E93798D170E971250963F025048928478825FC0F51A394C30987',
            name: 'Seed Account 3',
            networkIdentifier: 'testnet',
            accountType: 'seed',
            index: 3,
            privateKey: '5F6C9E8D5A3642D519B218AA8DD27D6ACA4ADC846B33746AB42FDD9B23E3BDA2',
        },
        {
            address: 'TAC3EH5ED6VV5AQUIS5D223BAT5ZMTJC2EQI3NQ',
            publicKey: 'FBCF8227DB64D12EA9F792F3F47939EFC413B1512BD0999758B817BD4CF7CF51',
            name: 'Seed Account 4',
            networkIdentifier: 'testnet',
            accountType: 'seed',
            index: 4,
            privateKey: '14F81341CEB72DDD694E7D4D3C17F4D58A6F00FFDAFCDA1A4BD2A554D67E3C95',
        },
    ],
};

export const networkIdentifiers = ['mainnet', 'testnet'];

export const currentNetworkIdentifier = 'testnet';

export const currentAccount = walletStorageAccounts[currentNetworkIdentifier][0];
