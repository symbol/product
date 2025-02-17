import 'react-native-gesture-handler';
import { TextDecoder, TextEncoder } from '@sinonjs/text-encoding';
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

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Register main component
AppRegistry.registerComponent(appName, () => App);
