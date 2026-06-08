const { spawnSync } = require('child_process');
const path = require('path');

jest.mock('@next/env', () => ({
	loadEnvConfig: jest.fn()
}));

describe('next.config', () => {
	const originalEnv = process.env;

	afterEach(() => {
		jest.resetModules();
		process.env = originalEnv;
	});

	const loadNextConfig = env => {
		jest.resetModules();
		process.env = {
			...originalEnv,
			...env
		};
		if (!('NEXT_PUBLIC_PLATFORM' in env))
			delete process.env.NEXT_PUBLIC_PLATFORM;
		if (!('PLATFORM' in env))
			delete process.env.PLATFORM;

		return require('../next.config');
	};

	const compileScss = scss => {
		const script = `
			const path = require('path');
			const sass = require('sass');
			const { pathToFileURL } = require('url');
			const result = sass.compileString(${JSON.stringify(scss)}, {
				loadPaths: ['.'],
				url: pathToFileURL(path.resolve('styles/globals.scss')),
				logger: sass.Logger.silent
			});
			process.stdout.write(result.css);
		`;
		const result = spawnSync(process.execPath, ['-e', script], {
			cwd: path.resolve(__dirname, '..'),
			encoding: 'utf8'
		});

		if (result.status)
			throw new Error(result.stderr);

		return result.stdout;
	};

	it('requires an explicit supported platform', () => {
		// Act + Assert:
		expect(() => loadNextConfig({}).sassOptions.additionalData('$color: red;', {
			resourcePath: '/workspace/styles/globals.scss'
		})).toThrow('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');
		expect(() => loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'catapult' }).sassOptions.additionalData('$color: red;', {
			resourcePath: '/workspace/styles/globals.scss'
		}))
			.toThrow('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');
	});

	it('configures NEM image paths with common and NEM asset locations', () => {
		// Act:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'nem' });

		// Assert:
		expect(nextConfig.images.localPatterns).toEqual([
			{
				pathname: '/images/**'
			},
			{
				pathname: '/nem/images/**'
			}
		]);
	});

	it('configures Symbol image paths with common and Symbol asset locations', () => {
		// Act:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Assert:
		expect(nextConfig.images.localPatterns).toEqual([
			{
				pathname: '/images/**'
			},
			{
				pathname: '/symbol/images/**'
			}
		]);
	});

	it('injects the selected variant variables into shared SCSS files', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Act:
		const result = nextConfig.sassOptions.additionalData('@import "./variables";\n$color: red;', {
			resourcePath: '/workspace/styles/globals.scss'
		});

		// Assert:
		expect(result).toBe('@import "./variables";\n@import "variants/symbol/styles/variables.scss";\n$color: red;');
	});

	it('resolves Symbol SCSS variables after shared variables are loaded', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });
		const scss = nextConfig.sassOptions.additionalData('@import "./variables";\n.test { color: $color-background-main; }', {
			resourcePath: '/workspace/styles/globals.scss'
		});

		// Act:
		const result = compileScss(scss);

		// Assert:
		expect(result).toContain('color: #1b0a29;');
		expect(result).not.toContain('color: #eef5f9;');
	});

	it('keeps Symbol SCSS variables when the variant import is prepended before shared variables', () => {
		// Arrange:
		const scss = [
			'@import "variants/symbol/styles/variables.scss";',
			'@import "./variables";',
			'.test { color: $color-background-main; font-family: $font-family-body; }'
		].join('\n');

		// Act:
		const result = compileScss(scss);

		// Assert:
		expect(result).toContain('color: #1b0a29;');
		expect(result).toContain('font-family: "Protipo-Regular", sans-serif;');
		expect(result).not.toContain('color: #eef5f9;');
		expect(result).not.toContain('font-family: Nunito Sans, sans-serif;');
	});

	it('prepends variant variables when a shared SCSS file does not import shared variables', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Act:
		const result = nextConfig.sassOptions.additionalData('.test { color: red; }', {
			resourcePath: '/workspace/styles/without-variables.scss'
		});

		// Assert:
		expect(result).toBe('@import "variants/symbol/styles/variables.scss";\n.test { color: red; }');
	});

	it('does not inject variant variables into variable or variant SCSS files', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Act + Assert:
		expect(nextConfig.sassOptions.additionalData('$color: red;', {
			resourcePath: '/workspace/styles/variables.scss'
		})).toBe('$color: red;');
		expect(nextConfig.sassOptions.additionalData('$color: red;', {
			resourcePath: 'C:\\workspace\\variants\\symbol\\styles\\variables.scss'
		})).toBe('$color: red;');
	});

	it('executes Next config callbacks in a native Node process', () => {
		// Arrange:
		const script = `
			const path = require('path');
			const sass = require('sass');
			const { pathToFileURL } = require('url');
			const nextConfig = require('./next.config');
			const injected = nextConfig.sassOptions.additionalData('@import "./variables";\\n.test { color: $color-background-main; }', {
				resourcePath: '/workspace/styles/globals.scss'
			});
			const skipped = nextConfig.sassOptions.additionalData('$color: red;', {
				resourcePath: 'C:\\\\workspace\\\\variants\\\\symbol\\\\styles\\\\variables.scss'
			});
			if (!injected.includes('variants/symbol/styles/variables.scss'))
				throw new Error('variant variables were not injected');
			const result = sass.compileString(injected, {
				loadPaths: ['.'],
				url: pathToFileURL(path.resolve('styles/globals.scss')),
				logger: sass.Logger.silent
			}).css;
			if (!result.includes('color: #1b0a29;'))
				throw new Error('variant variables did not override shared variables');
			if ('$color: red;' !== skipped)
				throw new Error('variant variables were injected into a variant file');
		`;

		// Act:
		const result = spawnSync(process.execPath, ['-e', script], {
			cwd: path.resolve(__dirname, '..'),
			encoding: 'utf8',
			env: {
				...process.env,
				NEXT_PUBLIC_PLATFORM: 'symbol'
			}
		});

		// Assert:
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});
});
