// Stub for bitcore-mnemonic, pulled in via symbol-sdk/Bip32.js → bitcore-mnemonic → bitcore-lib.
// bitcore-lib throws "More than one instance" when loaded twice. We never use BIP32/mnemonic
// functionality (only Address/Network/NetworkTimestamp), so this stub is safe.
class Mnemonic {}
export default Mnemonic;
