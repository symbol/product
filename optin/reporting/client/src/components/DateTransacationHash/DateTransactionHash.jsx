import Helper from '../../utils/helper';
import CopyButton from '../CopyButton';
import ResponsiveList from '../ResponsiveList';
import ResponsiveText from '../ResponsiveText';
import React from 'react';
import './DateTransactionHash.scss';

const buildTransactionHashLink = (linkBaseUrl, item, date) => {
	return (
		<div className='flex flex-row list-item'>
			{
				date && item &&
				<React.Fragment>
					<span className='timestamp'>{date}&nbsp;|&nbsp;</span>
					<a href={linkBaseUrl + item.toLowerCase()}
						target="_blank"
						rel="noreferrer">
						<ResponsiveText value={item.toLowerCase()} />
					</a>
					<CopyButton value={item.toLowerCase()} />
				</React.Fragment>
			}
		</div>
	);
};

const DateTransactionHash = ({values, linkBaseUrl, timestamps, listTitle = 'Hash List'}) => {
	const resultList = values.map((hash, index) =>
		<div>
			{
				null !== hash
					? buildTransactionHashLink(
						linkBaseUrl, hash,
						Helper.convertTimestampToDate(timestamps[index], Helper.getLocalTimezone())
					)
					: '(off chain)'
			}
		</div>);
	if (1 < resultList.length)
		resultList.push(<div className='list-item' />);

	return (
		<ResponsiveList title={listTitle}>
			{ React.Children.toArray(resultList) }
		</ResponsiveList>
	);
};

export default DateTransactionHash;
