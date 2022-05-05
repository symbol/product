import CopyButton from './../CopyButton';
import ResponsiveList from './../ResponsiveList';
import ResponsiveText from './../ResponsiveText';
import React from 'react';

const Address = ({values, linkBaseUrl, fixedLength=false, listTitle='Address List'}) => {
	return (
		<ResponsiveList title={listTitle}>
			{
				React.Children.toArray(values.map(address => (
					<div className='flex flex-row list-item'>
						<a href={linkBaseUrl + address} target="_blank" rel="noreferrer">
							<ResponsiveText value={address} fixedLength={fixedLength} />
						</a>
						<CopyButton value={address} />
					</div>
				)))
			}
		</ResponsiveList>
	);
};
export default Address;
