/**
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

if (!process.nextTick) {
    process = require('process');
}

if (!global.Buffer) {
    global.Buffer = require('buffer/').Buffer;
}

AppRegistry.registerComponent(appName, () => App);
