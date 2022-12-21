import { Platform, Vibration } from 'react-native';
import { showMessage } from 'react-native-flash-message';

export const trunc = (str, type, length = 5) => {
    const trunc = (text, cut, lengthFirst, lengthSecond) => {
        if (cut === 'start' && lengthFirst < text.length) {
            return '...' + text.substring(text.length - lengthFirst, text.length);
        }
        if (cut === 'middle' && lengthFirst + lengthSecond < text.length) {
            return text.substring(0, lengthFirst) + '...' + text.substring(text.length - lengthSecond, text.length);
        }
        if (cut === 'end' && lengthFirst < text.length) {
            return text.substring(0, lengthFirst) + '...';
        }

        return text;
    };

    if (typeof str !== 'string') {
        console.error(`Failed to trunc text. ${typeof str} is not a "string"`);
        return '';
    }

    switch (type) {
        case 'address':
            return trunc(str, 'middle', 6, 3);
        case 'address-short':
            return trunc(str, 'start', 3);
        case 'address-long':
            return trunc(str, 'middle', 12, 12);
        case 'contact':
            return trunc(str, 'end', 18);
        case 'contact-short':
            return trunc(str, 'end', 12);
        case 'hash':
            return trunc(str, 'middle', 12, 12);
        case 'mosaicId':
            return trunc(str, 'middle', 6, 6);
        case 'namespaceName':
            return trunc(str, 'middle', 10, 10);
        default:
            return trunc(str, 'end', length);
    }
}

export const handleError = (error) => {
    showMessage({message: error.message, type: 'danger'});
    console.error(error);
};

export const getCharPercentage = char => {
    const charset = [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'q',
        'r',
        's',
        't',
        'u',
        'v',
        'w',
        'x',
        'y',
        'z',
    ];
    const index = charset.indexOf(char.toLowerCase());
    
    return index / (charset.length - 1);
};

export const vibrate = () => {
    return {
        short() {
            if (Platform.OS === 'android') {
                Vibration.vibrate(2);
            }
        }
    }
}

export const toFixedNumber = (num, digits) => {
    const power = Math.pow(10, digits);

    return Math.round(num * power) / power;
}
