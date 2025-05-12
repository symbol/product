/**
 * @typedef {Object} Namespace
 * @property {string} id - Namespace id.
 * @property {string} name - Namespace name.
 * @property {"mosaic" | "address" | "none"} aliasType - Namespace alias type.
 * @property {string | null} linkedMosaicId - Linked mosaic id.
 * @property {string | null} linkedAddress - Linked address.
 * @property {number} startHeight - Namespace registration height.
 * @property {number} endHeight - Namespace expiration height.
 * @property {string} creator - Address of the namespace creator account (the account that registered the namespace).
 */

/**
 * @typedef {Object} NamespaceDTO
 * @property {number} version - The namespace version.
 * @property {number} registrationType - The namespace registration type.
 * @property {number} depth - The namespace depth.
 * @property {string} level0 - The root namespace id.
 * @property {string} [level1] - The sub namespace id.
 * @property {string} [level2] - The sub sub namespace id.
 * @property {Object} alias - The namespace alias.
 * @property {number} alias.type - The alias type.
 * @property {string} parentId - The parent namespace id.
 * @property {string} ownerAddress - The namespace owner address.
 * @property {string} startHeight - The namespace registration height.
 * @property {string} endHeight - The namespace expiration height.
 */

export default {};
