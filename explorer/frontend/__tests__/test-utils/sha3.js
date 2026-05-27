const crypto = require('crypto');

const sha3_256 = data => new Uint8Array(crypto.createHash('sha3-256').update(Buffer.from(data)).digest());

module.exports = {
	sha3_256
};
