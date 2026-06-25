/** @typedef {import('../types/Namespace').Namespace} Namespace */

/**
 * Converts a NEM namespace DTO to a Namespace object.
 * @param {object} namespaceDTO - The namespace DTO.
 * @returns {Namespace} The namespace object.
 */
export const namespaceFromDTO = namespaceDTO => {
	const namespace = namespaceDTO.namespace || namespaceDTO;

	return {
		id: namespace.fqn || String(namespace.id),
		name: namespace.fqn || String(namespace.id),
		height: namespace.height,
		owner: namespace.owner
	};
};
