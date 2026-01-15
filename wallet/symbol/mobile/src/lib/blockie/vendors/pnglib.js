/**
 * A handy class to generate PNG images.
 *
 * @version 1.0
 * @author Robert Eisele <robert@xarg.org>
 * @copyright Copyright (c) 2010, Robert Eisele
 * @link http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/
 * @license http://www.opensource.org/licenses/bsd-license.php BSD License
 *
 * Modified by George Chan <gchan@21cn.com>
 * Modified by Will O'B <@wbobeirne> to make it UglifyJS and "use strict"; friendly
 * Modified by Oleh Makarenko<@OlegMakarenko>. Refactored to ES modules with improved readability
 */

// PNG chunk constants
const PNG_SIGNATURE = '\x89PNG\r\n\x1a\n';
const IHDR_CHUNK_TYPE = 'IHDR';
const PLTE_CHUNK_TYPE = 'PLTE';
const TRNS_CHUNK_TYPE = 'tRNS';
const IDAT_CHUNK_TYPE = 'IDAT';
const IEND_CHUNK_TYPE = 'IEND';

// Deflate constants
const DEFLATE_MAX_BLOCK_SIZE = 0xffff;
const DEFLATE_HEADER_WINDOW_SIZE = 8;
const DEFLATE_HEADER_COMPRESSION_METHOD = 7;

// Adler32 constants
const ADLER32_BASE = 65521; // Largest prime smaller than 65536
const ADLER32_NMAX = 5552; // Largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1

// CRC32 polynomial
const CRC32_POLYNOMIAL = -306674912;

// Base64 encoding characters
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Write string data to buffer at specified offset.
 * @param {string[]} buffer - The buffer array to write to
 * @param {number} offset - Starting offset in the buffer
 * @param {...string} dataChunks - String data chunks to write
 */
const writeToBuffer = (buffer, offset, ...dataChunks) => {
	let currentOffset = offset;
	for (const chunk of dataChunks) {
		for (let charIndex = 0; charIndex < chunk.length; charIndex++) 
			buffer[currentOffset++] = chunk.charAt(charIndex);    
	}
};

/**
 * Convert a 16-bit word to a 2-byte big-endian string.
 * @param {number} word - The 16-bit value
 * @returns {string} Two-character string representation
 */
const wordToBytesBigEndian = word => {
	return String.fromCharCode((word >> 8) & 255, word & 255);
};

/**
 * Convert a 32-bit word to a 4-byte big-endian string.
 * @param {number} word - The 32-bit value
 * @returns {string} Four-character string representation
 */
const doubleWordToBytesBigEndian = word => {
	return String.fromCharCode(
		(word >> 24) & 255,
		(word >> 16) & 255,
		(word >> 8) & 255,
		word & 255
	);
};

/**
 * Convert a 16-bit word to a 2-byte little-endian string.
 * @param {number} word - The 16-bit value
 * @returns {string} Two-character string representation
 */
const wordToBytesLittleEndian = word => {
	return String.fromCharCode(word & 255, (word >> 8) & 255);
};

/**
 * Generate CRC32 lookup table.
 * @returns {number[]} CRC32 lookup table with 256 entries
 */
const generateCrc32Table = () => {
	const table = new Array(256);

	for (let index = 0; index < 256; index++) {
		let crcValue = index;
		for (let bit = 0; bit < 8; bit++) {
			if (crcValue & 1)
				crcValue = CRC32_POLYNOMIAL ^ ((crcValue >> 1) & 0x7fffffff);
			else
				crcValue = (crcValue >> 1) & 0x7fffffff;
		}
		table[index] = crcValue;
	}

	return table;
};

/**
 * Calculate CRC32 checksum for a PNG chunk and write it to the buffer.
 * @param {string[]} buffer - The PNG buffer
 * @param {number} chunkOffset - Offset of the chunk in the buffer
 * @param {number} chunkSize - Size of the chunk
 * @param {number[]} crcTable - Pre-computed CRC32 lookup table
 */
const writeCrc32Checksum = (buffer, chunkOffset, chunkSize, crcTable) => {
	let crc = -1;

	// Calculate CRC for chunk type and data (skip length, include type and data, exclude CRC field)
	for (let index = 4; index < chunkSize - 4; index++) {
		const byteValue = buffer[chunkOffset + index].charCodeAt(0);
		crc = crcTable[(crc ^ byteValue) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
	}

	writeToBuffer(buffer, chunkOffset + chunkSize - 4, doubleWordToBytesBigEndian(crc ^ -1));
};

/**
 * PNG image generator class.
 */
export class PngImage {
	/**
     * Create a new PNG image.
     * @param {number} width - Image width in pixels
     * @param {number} height - Image height in pixels
     * @param {number} colorDepth - Number of colors in the palette
     */
	constructor(width, height, colorDepth) {
		this.width = width;
		this.height = height;
		this.colorDepth = colorDepth;

		// Pixel data size includes row filter bytes (one per row)
		this.pixelDataSize = height * (width + 1);

		// Calculate deflate data size: header + pixel data + block headers + adler32
		const blockCount = Math.floor((DEFLATE_MAX_BLOCK_SIZE + this.pixelDataSize) / DEFLATE_MAX_BLOCK_SIZE);
		this.deflateDataSize = 2 + this.pixelDataSize + (5 * blockCount) + 4;

		// Calculate chunk offsets and sizes
		this.ihdrOffset = 0;
		this.ihdrSize = 4 + 4 + 13 + 4; // length + type + data + crc

		this.plteOffset = this.ihdrOffset + this.ihdrSize;
		this.plteSize = 4 + 4 + (3 * colorDepth) + 4;

		this.trnsOffset = this.plteOffset + this.plteSize;
		this.trnsSize = 4 + 4 + colorDepth + 4;

		this.idatOffset = this.trnsOffset + this.trnsSize;
		this.idatSize = 4 + 4 + this.deflateDataSize + 4;

		this.iendOffset = this.idatOffset + this.idatSize;
		this.iendSize = 4 + 4 + 4;

		this.totalSize = this.iendOffset + this.iendSize;

		// Initialize buffer and palette
		this.buffer = new Array(this.totalSize).fill('\x00');
		this.palette = {};
		this.paletteIndex = 0;
		this.crcTable = generateCrc32Table();

		this._initializeChunks();
		this._initializeDeflateBlocks();
	}

	/**
     * Initialize PNG chunk headers.
     * @private
     */
	_initializeChunks() {
		// IHDR chunk
		writeToBuffer(
			this.buffer,
			this.ihdrOffset,
			doubleWordToBytesBigEndian(this.ihdrSize - 12),
			IHDR_CHUNK_TYPE,
			doubleWordToBytesBigEndian(this.width),
			doubleWordToBytesBigEndian(this.height),
			'\x08\x03' // 8-bit depth, indexed color
		);

		// PLTE chunk
		writeToBuffer(
			this.buffer,
			this.plteOffset,
			doubleWordToBytesBigEndian(this.plteSize - 12),
			PLTE_CHUNK_TYPE
		);

		// tRNS chunk
		writeToBuffer(
			this.buffer,
			this.trnsOffset,
			doubleWordToBytesBigEndian(this.trnsSize - 12),
			TRNS_CHUNK_TYPE
		);

		// IDAT chunk
		writeToBuffer(
			this.buffer,
			this.idatOffset,
			doubleWordToBytesBigEndian(this.idatSize - 12),
			IDAT_CHUNK_TYPE
		);

		// IEND chunk
		writeToBuffer(
			this.buffer,
			this.iendOffset,
			doubleWordToBytesBigEndian(this.iendSize - 12),
			IEND_CHUNK_TYPE
		);
	}

	/**
     * Initialize deflate stream headers and block structure.
     * @private
     */
	_initializeDeflateBlocks() {
		// Deflate header
		const headerValue = ((DEFLATE_HEADER_WINDOW_SIZE + (DEFLATE_HEADER_COMPRESSION_METHOD << 4)) << 8) | (3 << 6);
		const headerWithChecksum = headerValue + (31 - (headerValue % 31));
		writeToBuffer(this.buffer, this.idatOffset + 8, wordToBytesBigEndian(headerWithChecksum));

		// Initialize deflate block headers
		for (let blockIndex = 0; (blockIndex << 16) - 1 < this.pixelDataSize; blockIndex++) {
			let blockSize;
			let blockFlags;

			if (blockIndex + DEFLATE_MAX_BLOCK_SIZE < this.pixelDataSize) {
				blockSize = DEFLATE_MAX_BLOCK_SIZE;
				blockFlags = '\x00'; // Not final block
			} else {
				blockSize = this.pixelDataSize - (blockIndex << 16) - blockIndex;
				blockFlags = '\x01'; // Final block
			}

			const blockHeaderOffset = this.idatOffset + 8 + 2 + (blockIndex << 16) + (blockIndex << 2);
			writeToBuffer(
				this.buffer,
				blockHeaderOffset,
				blockFlags,
				wordToBytesLittleEndian(blockSize),
				wordToBytesLittleEndian(~blockSize)
			);
		}
	}

	/**
     * Calculate the buffer index for a pixel at given coordinates.
     * @param {number} x - X coordinate (can be -1 for row filter byte)
     * @param {number} y - Y coordinate
     * @returns {number} Buffer index
     */
	getPixelIndex(x, y) {
		const pixelOffset = (y * (this.width + 1)) + x + 1;
		const blockOffset = Math.floor((pixelOffset / DEFLATE_MAX_BLOCK_SIZE) + 1);
        
		return this.idatOffset + 8 + 2 + (5 * blockOffset) + pixelOffset;
	}

	/**
     * Register a color in the palette and return its index.
     * @param {number} red - Red component (0-255)
     * @param {number} green - Green component (0-255)
     * @param {number} blue - Blue component (0-255)
     * @param {number} [alpha=255] - Alpha component (0-255)
     * @returns {string} Single character representing the palette index
     */
	registerColor(red, green, blue, alpha = 255) {
		const colorKey = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

		if (this.palette[colorKey] === undefined) {
			if (this.paletteIndex >= this.colorDepth)
				return '\x00'; // Palette full, return first color

			// Add color to PLTE chunk
			const paletteOffset = this.plteOffset + 8 + (3 * this.paletteIndex);
			this.buffer[paletteOffset] = String.fromCharCode(red);
			this.buffer[paletteOffset + 1] = String.fromCharCode(green);
			this.buffer[paletteOffset + 2] = String.fromCharCode(blue);

			// Add alpha to tRNS chunk
			this.buffer[this.trnsOffset + 8 + this.paletteIndex] = String.fromCharCode(alpha);

			this.palette[colorKey] = String.fromCharCode(this.paletteIndex++);
		}

		return this.palette[colorKey];
	}

	/**
     * Calculate Adler32 checksum and finalize the PNG.
     * @private
     * @returns {string} Complete PNG data as a string
     */
	_finalize() {
		// Compute Adler32 checksum
		let sum1 = 1;
		let sum2 = 0;
		let remaining = ADLER32_NMAX;

		for (let y = 0; y < this.height; y++) {
			for (let x = -1; x < this.width; x++) {
				sum1 += this.buffer[this.getPixelIndex(x, y)].charCodeAt(0);
				sum2 += sum1;

				remaining--;
				if (remaining === 0) {
					sum1 %= ADLER32_BASE;
					sum2 %= ADLER32_BASE;
					remaining = ADLER32_NMAX;
				}
			}
		}

		sum1 %= ADLER32_BASE;
		sum2 %= ADLER32_BASE;

		writeToBuffer(
			this.buffer,
			this.idatOffset + this.idatSize - 8,
			doubleWordToBytesBigEndian((sum2 << 16) | sum1)
		);

		// Write CRC32 checksums for all chunks
		writeCrc32Checksum(this.buffer, this.ihdrOffset, this.ihdrSize, this.crcTable);
		writeCrc32Checksum(this.buffer, this.plteOffset, this.plteSize, this.crcTable);
		writeCrc32Checksum(this.buffer, this.trnsOffset, this.trnsSize, this.crcTable);
		writeCrc32Checksum(this.buffer, this.idatOffset, this.idatSize, this.crcTable);
		writeCrc32Checksum(this.buffer, this.iendOffset, this.iendSize, this.crcTable);

		return PNG_SIGNATURE + this.buffer.join('');
	}

	/**
     * Get the PNG data as a raw string.
     * @returns {string} PNG data
     */
	getData() {
		return this._finalize();
	}

	/**
     * Get the PNG data as a Base64-encoded string.
     * @returns {string} Base64-encoded PNG data
     */
	getBase64() {
		const pngData = this._finalize();
		let result = '';

		for (let i = 0; i < pngData.length; i += 3) {
			const char1 = pngData.charCodeAt(i);
			const char2 = pngData.charCodeAt(i + 1);
			const char3 = pngData.charCodeAt(i + 2);

			const encoded1 = char1 >> 2;
			const encoded2 = ((char1 & 3) << 4) | (char2 >> 4);
			const encoded3 = pngData.length < i + 2 ? 64 : ((char2 & 0xf) << 2) | (char3 >> 6);
			const encoded4 = pngData.length < i + 3 ? 64 : char3 & 0x3f;

			result += BASE64_CHARS.charAt(encoded1)
                + BASE64_CHARS.charAt(encoded2)
                + BASE64_CHARS.charAt(encoded3)
                + BASE64_CHARS.charAt(encoded4);
		}

		return result;
	}
}

export default PngImage;
