import { describeEachBrand, getBrandPath, loadBrandModule } from './contract-test-helpers';
import brandNames from '@/contract/brands.json';
import { requiredConfigs } from '@/contract/configs';
import ts from 'typescript';
import fs from 'fs';
import path from 'path';


const SRC_DIRECTORY = path.join(__dirname, '../../src');
const PNG_MODULES_DECLARATION_PATH = path.join(__dirname, 'png-modules.d.ts');
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
	paths: {
		'@/app/*': [path.join(SRC_DIRECTORY, 'main/*')],
		'@/contract/*': [path.join(SRC_DIRECTORY, 'contract/*')]
	}
};

const getConfigFilePath = (brand, requiredConfig) => getBrandPath(brand, `${requiredConfig.path}.js`);

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
		typeFile: typeDeclaration ? path.relative(SRC_DIRECTORY, typeDeclaration.getSourceFile().fileName) : null
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
		const configFilePaths = brandNames.flatMap(brand =>
			requiredConfigs.map(requiredConfig => getConfigFilePath(brand, requiredConfig)));

		program = ts.createProgram([...configFilePaths, PNG_MODULES_DECLARATION_PATH], COMPILER_OPTIONS);
	}, TYPE_CHECK_TIMEOUT);

	afterAll(() => {
		program = null;
	});

	describeEachBrand(brand => {
		requiredConfigs.forEach(requiredConfig => {
			describe(requiredConfig.exportName, () => {
				it('file exists', () => {
					// Arrange:
					const filePath = getConfigFilePath(brand, requiredConfig);
					const configDirectory = path.dirname(filePath);
					const configFileName = path.basename(filePath);

					// Act:
					const directoryFileNames = fs.readdirSync(configDirectory);

					// Assert:
					expect(directoryFileNames).toContain(configFileName);
				});

				it('export name is correct', () => {
					// Act:
					const exportNames = Object.keys(loadBrandModule(brand, requiredConfig.path));

					// Assert:
					expect(exportNames).toContain(requiredConfig.exportName);
				});

				it('export uses the contract type', () => {
					// Arrange:
					const filePath = getConfigFilePath(brand, requiredConfig);
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
					const filePath = getConfigFilePath(brand, requiredConfig);

					// Act:
					const typeErrors = getFileTypeErrors(program, filePath);

					// Assert:
					expect(typeErrors).toEqual([]);
				});
			});
		});
	});
});
