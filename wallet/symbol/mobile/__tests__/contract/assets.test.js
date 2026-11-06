import { describeEachBrand, getBrandPath, loadBrandModule } from './contract-test-helpers';
import { requiredAssets } from '@/contract/assets';
import { iconNamesByVariant } from '@/contract/icons';
import fs from 'fs';


const IMAGE_FILE_EXTENSION = '.png';

const ICON_CONFIG_PATH = 'config/icon-config';
const ICONS_FOLDER = 'assets/images/icons';
const ICON_SOURCE_MAP_PATH = `${ICONS_FOLDER}/icon-source-map`;

const TOKEN_AVATAR_CONFIG_PATH = 'config/token-avatar-config';
const TOKEN_IMAGES_FOLDER = 'assets/images/tokens';
const TOKEN_IMAGE_SOURCE_MAP_PATH = `${TOKEN_IMAGES_FOLDER}/token-image-source-map`;
const DEFAULT_TOKEN_ID = 'default';

describe('contract/assets', () => {
	describe('required image folders', () => {
		describeEachBrand(brand => {
			requiredAssets.forEach(requiredAssetFolder => {
				it(`directory "${requiredAssetFolder.folder}" contains all required image files`, () => {
					// Arrange:
					const folderPath = getBrandPath(brand, requiredAssetFolder.folder);
					const folderFileNames = fs.readdirSync(folderPath);

					// Act:
					const missingNames = requiredAssetFolder.names
						.filter(name => !folderFileNames.includes(name + IMAGE_FILE_EXTENSION));

					// Assert:
					expect(missingNames).toEqual([]);
				});
			});
		});
	});

	describe('icons', () => {
		describeEachBrand(brand => {
			Object.entries(iconNamesByVariant).forEach(([variant, iconNames]) => {
				it(`variant "${variant}" has all required image files`, () => {
					// Arrange:
					const { iconConfig: config } = loadBrandModule(brand, ICON_CONFIG_PATH);
					const { iconSourceMap: sourceMap } = loadBrandModule(brand, ICON_SOURCE_MAP_PATH);
					const variantFolderName = config.variants[variant];
					const folderFileNames = fs.readdirSync(getBrandPath(brand, `${ICONS_FOLDER}/${variantFolderName}`));

					// Act:
					const iconNamesMissingInSourceMap = iconNames
						.filter(iconName => !sourceMap[variantFolderName]?.[iconName]);
					const iconNamesMissingOnDisk = iconNames
						.filter(iconName => !folderFileNames.includes(iconName + IMAGE_FILE_EXTENSION));

					// Assert:
					expect(iconNamesMissingInSourceMap).toEqual([]);
					expect(iconNamesMissingOnDisk).toEqual([]);
				});
			});
		});
	});

	describe('token images', () => {
		describeEachBrand(brand => {
			it('has a default entry', () => {
				// Arrange:
				const { tokenAvatarConfig } = loadBrandModule(brand, TOKEN_AVATAR_CONFIG_PATH);

				// Act & Assert:
				expect(tokenAvatarConfig.images).toHaveProperty(DEFAULT_TOKEN_ID);
			});

			it('every config entry has small, medium and large images', () => {
				// Arrange:
				const { tokenAvatarConfig: config } = loadBrandModule(brand, TOKEN_AVATAR_CONFIG_PATH);
				const { tokenImageSourceMap: sourceMap } = loadBrandModule(brand, TOKEN_IMAGE_SOURCE_MAP_PATH);
				const folderFileNames = fs.readdirSync(getBrandPath(brand, TOKEN_IMAGES_FOLDER));
				const configEntries = Object.values(config.images);
				const configImageNames = configEntries.flatMap(configEntry => Object.values(configEntry));
				const configEntryShape = {
					small: expect.any(String),
					medium: expect.any(String),
					large: expect.any(String)
				};

				// Act:
				const imageNamesMissingInSourceMap = configImageNames
					.filter(imageName => !sourceMap[imageName]);
				const imageNamesMissingOnDisk = configImageNames
					.filter(imageName => !folderFileNames.includes(imageName + IMAGE_FILE_EXTENSION));

				// Assert:
				configEntries.forEach(configEntry => expect(configEntry).toEqual(configEntryShape));
				expect(imageNamesMissingInSourceMap).toEqual([]);
				expect(imageNamesMissingOnDisk).toEqual([]);
			});
		});
	});
});
