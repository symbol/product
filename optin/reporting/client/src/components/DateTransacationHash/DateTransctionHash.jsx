import Helper from '../../utils/helper';
import CopyButton from '../CopyButton';
import ResponsiveList from '../ResponsiveList';
import ResponsiveText from '../ResponsiveText';
import './DateTransctionHash.scss';

const buildTransactionHashLink = (linkBaseUrl, item, date, fixResponsiveText) => {
	return (
		<div className='flex flex-row list-item'>
			{
				(item) ? (
					<>
						<span className='timestamp'> {date}&nbsp;|&nbsp;</span>
						<a href={linkBaseUrl + item.toLowerCase()}
							target="_blank"
							rel="noreferrer">
							<ResponsiveText value={item.toLowerCase()} fixedLength={fixResponsiveText} />
						</a>
						<CopyButton value={item.toLowerCase()} />
					</>
				) : null
			}
		</div>
	);
};

const DateTransactionHash = ({values, linkBaseUrl, timestamps, fixedLength = false, listTitle = 'Hash List'}) => {
	const resultList = values.map((hash, index) =>
		<div>
			{
				null !== hash
					? buildTransactionHashLink(linkBaseUrl, hash, Helper.convertTimestampToDate(timestamps[index], true), fixedLength)
					: '(off chain)'
			}
		</div>);
	if (1 < resultList.length)
		resultList.push(<div className='list-item' />);

	return (
		<ResponsiveList title={listTitle}>
			{resultList}
		</ResponsiveList>
	);
};

export default DateTransactionHash;
