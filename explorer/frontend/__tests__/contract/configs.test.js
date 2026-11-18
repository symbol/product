import { describeEachVariant, getVariantPath, loadVariantModule } from './contract-test-helpers';
import jsConfig from '../../jsconfig.json';
import { requiredConfigs } from '@/contract/configs';
import variantNames from '@/contract/variants.json';
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const FRONTEND_DIRECTORY = path.join(__dirname, '../..');
const CONTRACT_CONFIG_TYPES_FILE = 'contract/types/Config.js';
const FILE_NOT_FOUND_ERROR = 'file not found';
const TYPE_CHECK_TIMEOUT = 30000;

const COMPILER_OPTIONS = {
	allowJs: true,
	checkJs: true,
	noEmit: true,
	skipLibCheck: true,
	jsx: ts.JsxEmit.ReactJSX,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	target: ts.ScriptTarget.ES2022,
	types: [],
	baseUrl: FRONTEND_DIRECTORY,
	paths: jsConfig.compilerOptions.paths
};

const getConfigFilePath = (variant, requiredConfig) => getVariantPath(variant, `${requiredConfig.path}.js`);

const formatDiagnostic = diagnostic => {
	const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
	const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');

	return `${line + 1}: ${message}`;
};

const getExportedType = (program, filePath, exportName) => {
	const sourceFile = program.getSourceFile(filePath);

	if (!sourceFile)
		return null;

	const checker = program.getTypeChecker();
	const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
	const exportSymbol = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === exportName);

	if (!exportSymbol)
		return null;

	const exportType = checker.getTypeOfSymbol(exportSymbol);
	const typeDeclaration = exportType.aliasSymbol?.declarations?.[0];

	return {
		typeName: checker.typeToString(exportType),
		typeFile: typeDeclaration ? path.relative(FRONTEND_DIRECTORY, typeDeclaration.getSourceFile().fileName) : null
	};
};

const getFileTypeErrors = (program, filePath) => {
	const sourceFile = program.getSourceFile(filePath);

	if (!sourceFile)
		return [FILE_NOT_FOUND_ERROR];

	const diagnostics = [
		...program.getSyntacticDiagnostics(sourceFile),
		...program.getSemanticDiagnostics(sourceFile)
	];

	return diagnostics.map(formatDiagnostic);
};

describe('contract/configs', () => {
	let program;

	beforeAll(() => {
		const configFilePaths = variantNames.flatMap(variant =>
			requiredConfigs.map(requiredConfig => getConfigFilePath(variant, requiredConfig)));

		program = ts.createProgram(configFilePaths, COMPILER_OPTIONS);
	}, TYPE_CHECK_TIMEOUT);

	afterAll(() => {
		program = null;
	});

	describeEachVariant(variant => {
		requiredConfigs.forEach(requiredConfig => {
			describe(requiredConfig.exportName, () => {
				it('file exists', () => {
					// Arrange:
					const filePath = getConfigFilePath(variant, requiredConfig);
					const configDirectory = path.dirname(filePath);
					const configFileName = path.basename(filePath);

					// Act:
					const directoryFileNames = fs.readdirSync(configDirectory);

					// Assert:
					expect(directoryFileNames).toContain(configFileName);
				});

				it('export name is correct', () => {
					// Act:
					const exportNames = Object.keys(loadVariantModule(variant, requiredConfig.path));

					// Assert:
					expect(exportNames).toContain(requiredConfig.exportName);
				});

				it('export uses the contract type', () => {
					// Arrange:
					const filePath = getConfigFilePath(variant, requiredConfig);
					const expectedType = {
						typeName: requiredConfig.typeName,
						typeFile: CONTRACT_CONFIG_TYPES_FILE
					};

					// Act:
					const exportedType = getExportedType(program, filePath, requiredConfig.exportName);

					// Assert:
					expect(exportedType).toEqual(expectedType);
				});

				it('values match the contract type', () => {
					// Arrange:
					const filePath = getConfigFilePath(variant, requiredConfig);

					// Act:
					const typeErrors = getFileTypeErrors(program, filePath);

					// Assert:
					expect(typeErrors).toEqual([]);
				});
			});
		});
	});
});
