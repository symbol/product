import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Override Node modules
if (!process.nextTick) {
    process = require('process');
}

if (!global.Buffer) {
    global.Buffer = require('buffer/').Buffer;
}

// Register main component
AppRegistry.registerComponent(appName, () => App);
