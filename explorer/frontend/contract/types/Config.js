/** @typedef {import('react')} React */

/**
 * Account info page config.
 * @typedef {object} AccountInfoPageConfig
 * @property {boolean} isEmptyBlockFilterVisible - Whether the empty block filter is shown in the harvested blocks section.
 */

/**
 * Block list page config.
 * @typedef {object} BlockListPageConfig
 * @property {'page'|'cursor'} paginationMode - Pagination mode of the block list.
 * @property {boolean} isStatementCountColumnVisible - Whether the statement count column is shown in the table.
 * @property {boolean} isBlockRewardColumnVisible - Whether the block reward column is shown in the table.
 */

/**
 * Home page section config.
 * @typedef {object} HomeSectionItem
 * @property {string} id - Unique key in the list.
 * @property {function(): React.ReactNode} Component - Section component.
 */

/**
 * Home page config.
 * @typedef {object} HomePageConfig
 * @property {boolean} isSupernodeCountVisible - Whether the supernode count is shown on the home page.
 * @property {HomeSectionItem[]} sections - Variant sections rendered after the recent blocks.
 */

/**
 * ValueMessage config.
 * @typedef {object} ValueMessageConfig
 * @property {Record<string, string>} labelLocaleKeys - Label localization key for each message type.
 * A message type without a key renders no label.
 */

/**
 * Render variant for a transaction body field, determining how the value is displayed.
 * @typedef {'account' | 'boolean' | 'copy' | 'delta' | 'fee' | 'message' | 'mosaic' | 'mosaicAmount' | 'namespace'
 * | 'text' | 'transactionType' | 'translate'} TransactionBodyFieldRenderer
 */

/**
 * Transaction graphic target renderer.
 * @typedef {'account' | 'lock' | 'mosaic' | 'namespace'} TransactionGraphicTargetRenderer
 */

/**
 * Config of an individual transaction body field.
 * @typedef {object} TransactionBodyField
 * @property {string} name - Transaction field name. The title localization key is "field_<name>".
 * @property {TransactionBodyFieldRenderer} renderer - How to render the value.
 */

/**
 * Transaction graphic target config (that circle on the right side from the arrow).
 * @typedef {object} TransactionGraphicTarget
 * @property {string} name - Transaction field name. The field holds an account address for the account renderer,
 * mosaic id for the mosaic renderer, namespace id for the namespace renderer, duration for the lock renderer.
 * @property {TransactionGraphicTargetRenderer} renderer - Renderer of the target.
 * @property {string} localeKey - Target title localization key.
 */

/**
 * Transaction graphic config for specific transaction type.
 * @typedef {object} TransactionGraphicConfig
 * @property {TransactionGraphicTarget|null} target - Target of the graphic or null for unsupported types.
 */

/**
 * Transaction body config for specific transaction type.
 * @typedef {object} TransactionBodyConfig
 * @property {TransactionGraphicConfig} graphic - Graphic config for the transaction body.
 * @property {TransactionBodyField[]} bodyFields - Fields rendered next to the graphic, in display order.
 */

/**
 * Transaction info page config.
 * @typedef {object} TransactionInfoPageConfig
 * @property {boolean} isFeesBreakdownSectionVisible - Whether the fees breakdown section is shown for an aggregate transaction.
 * @property {Record<string, TransactionBodyConfig>} transactions - Body config per transaction type.
 */

export {};
