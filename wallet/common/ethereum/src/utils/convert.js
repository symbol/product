const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const hexToBase32 = hexString => {
	// Convert hex to binary string
	let binaryString = '';
	hexString.split('').forEach(hexCharacter => {
		const binaryChunk = parseInt(hexCharacter, 16).toString(2).padStart(4, '0');
		binaryString += binaryChunk;
	});

	// Group binary string into 5-bit chunks
	const base32Characters = [];
	for (let bitIndex = 0; bitIndex < binaryString.length; bitIndex += 5) {
		const binaryChunk = binaryString.slice(bitIndex, bitIndex + 5);
		if (binaryChunk.length < 5) {
			// pad last chunk
			const paddedChunk = binaryChunk.padEnd(5, '0');
			const base32Character = BASE32_ALPHABET[parseInt(paddedChunk, 2)];
			base32Characters.push(base32Character);
		} else {
			const base32Character = BASE32_ALPHABET[parseInt(binaryChunk, 2)];
			base32Characters.push(base32Character);
		}
	}

	return base32Characters.join('');
};

export const base32ToHex = base32String => {
	// Convert base32 to binary string
	let binaryString = '';
	base32String.split('').forEach(base32Character => {
		const characterIndex = BASE32_ALPHABET.indexOf(base32Character.toUpperCase());
		const binaryChunk = characterIndex.toString(2).padStart(5, '0');
		binaryString += binaryChunk;
	});

	// Group binary string into 4-bit chunks
	const hexCharacters = [];
	for (let bitIndex = 0; bitIndex < binaryString.length; bitIndex += 4) {
		const binaryChunk = binaryString.slice(bitIndex, bitIndex + 4);
		if (binaryChunk.length === 4) {
			const hexCharacter = parseInt(binaryChunk, 2).toString(16).toUpperCase();
			hexCharacters.push(hexCharacter);
		}
	}

	// Trim a trailing padding nibble if present (case: base32 length % 4 === 0 adds 4 zero bits)
	if (
		base32String.length % 4 === 0 &&
        hexCharacters.length % 2 === 1 &&
        hexCharacters[hexCharacters.length - 1] === '0'
	) 
		hexCharacters.pop();
    

	return hexCharacters.join('');
};
