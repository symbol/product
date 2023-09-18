import { EVENT, STORAGE_KEY } from '@/constants';

export const copyToClipboard = async text => {
	if (navigator.clipboard) {
		return navigator.clipboard.writeText(text);
	}

	const textArea = document.createElement('textarea');
	let success = false;

	textArea.value = text;
	textArea.style.top = '0';
	textArea.style.left = '0';
	textArea.style.position = 'fixed';
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		success = document.execCommand('copy');
	} catch {}

	document.body.removeChild(textArea);

	if (!success) {
		throw Error('Failed to copy to clipboard');
	}
};

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
			return trunc(str, 'middle', 4, 4);
		case 'mosaicId':
			return trunc(str, 'middle', 6, 6);
		case 'namespaceName':
			return trunc(str, 'middle', 10, 10);
		default:
			return trunc(str, 'end', length);
	}
};

export const getContactsFromStorage = () => {
	const defaultValue = [];

	try {
		const jsonString = localStorage.getItem(STORAGE_KEY.ADDRESS_BOOK);
		return JSON.parse(jsonString) || defaultValue;
	} catch {
		return defaultValue;
	}
};

export const setContactsToStorage = value => {
	localStorage.setItem(STORAGE_KEY.ADDRESS_BOOK, JSON.stringify(value));
	dispatchEvent(new Event(EVENT.ADDRESS_BOOK_UPDATE));
};

export const getTimestampTypeFromStorage = () => {
	const defaultValue = 'UTC';

	try {
		const value = localStorage.getItem(STORAGE_KEY.STORAGE_KEY);
		return value || defaultValue;
	} catch {
		return defaultValue;
	}
};

export const setTimestampTypeToStorage = value => {
	localStorage.setItem(STORAGE_KEY.STORAGE_KEY, value);
	dispatchEvent(new Event(EVENT.TIMESTAMP_TYPE_UPDATE));
};
