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
        case 'mosaicId':
            return trunc(str, 'middle', 6, 6);
        case 'namespaceName':
            return trunc(str, 'middle', 10, 10);
        default:
            return trunc(str, 'end', length);
    }
}
