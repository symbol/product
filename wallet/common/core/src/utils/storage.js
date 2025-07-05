export const decodeJson = json => {
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
};

export const encodeNullableString = value => {
	return value === null ? 'null' : value;
};

export const decodeNullableString = value => {
	return value === 'null' ? null : value;
};
