/**
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

if (!process.nextTick) {
    process = require('process');
}

AppRegistry.registerComponent(appName, () => App);
