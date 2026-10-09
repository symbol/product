import BlockImportance from './BlockImportance';
import BlockMerkle from './BlockMerkle';
import Finalization from './Finalization';

// Variant-specific page-section components, keyed by the name referenced from page config
// (see config/pages/*.json `additionalSections[].component`).
const components = {
	BlockImportance,
	BlockMerkle,
	Finalization
};

export default components;
