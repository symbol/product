/**
 * Create wallet screen config.
 * @typedef {object} CreateWalletScreenConfig
 * @property {boolean} isLogoVisible - Whether the logo is shown at the top of the screen.
 * @property {boolean} isStepsVisible - Whether the step progress indicator is shown at the top of the screen.
 */

/**
 * Import wallet screen config.
 * @typedef {object} ImportWalletScreenConfig
 * @property {boolean} isLogoVisible - Whether the logo is shown at the top of the screen.
 */

/**
 * Wallet creation animation props.
 * @typedef {object} WalletCreationAnimationProps
 * @property {string[]} steps - List of all steps text.
 * @property {number} currentStep - Current step number (starting from 1).
 */

/**
 * Welcome view props.
 * @typedef {object} WelcomeViewProps
 * @property {function(): void} onCreateWalletPress - Callback when the create wallet button is pressed.
 * @property {function(): void} onImportWalletPress - Callback when the import wallet button is pressed.
 */

export {};
