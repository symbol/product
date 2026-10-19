import Finalization from './Finalization';
import TransactionFilter from './TransactionFilter';

// Variant-specific page-section components, keyed by the name referenced from page config
// (see config/pages/*.json `additionalSections[].component`).
const components = {
	Finalization,
	TransactionFilter
};

export default components;
