import ValueBlockHeight from './ValueBlockHeight';

const SectionHeaderTransaction = ({ height, timestamp }) => {
	return <ValueBlockHeight value={height} timestamp={timestamp} size="md" />;
};

export default SectionHeaderTransaction;
