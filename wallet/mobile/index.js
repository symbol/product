/**
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

if (!process.version) {
    process.version = '';
}

AppRegistry.registerComponent(appName, () => App);
