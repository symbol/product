import { formatDate } from '../utils';

const ValueTimestamp = ({ value, hasTime }) => {
	const formattedDate = formatDate(value, null, hasTime);

	return <div>{formattedDate}</div>;
}

export default ValueTimestamp;
