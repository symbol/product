module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        '@babel/plugin-proposal-export-default-from',
        'react-native-reanimated/plugin',
        [
            require.resolve('babel-plugin-module-resolver'),
            {
                root: ['./'],
                alias: {
                    config: './src/config',
                    src: './src',
                },
            },
        ],
    ],
};
