import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Resolves extensionless relative imports used in this package for plain Node execution.
 * @param {string} specifier - The requested module specifier.
 * @param {object} context - The Node loader context.
 * @param {Function} defaultResolve - The default Node resolver.
 * @returns {Promise<{url: string, shortCircuit?: boolean}>} The resolved module URL.
 */
export const resolve = async (specifier, context, defaultResolve) => {
	try {
		return await defaultResolve(specifier, context, defaultResolve);
	} catch (error) {
		if (!specifier.startsWith('.') && !specifier.startsWith('/'))
			throw error;

		const parentPath = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
		const candidateBasePath = path.resolve(parentPath, specifier);
		const candidates = [
			`${candidateBasePath}.js`,
			path.join(candidateBasePath, 'index.js')
		];

		for (const candidatePath of candidates) {
			if (fs.existsSync(candidatePath)) {
				return {
					url: pathToFileURL(candidatePath).href,
					shortCircuit: true
				};
			}
		}

		throw error;
	}
};