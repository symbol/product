import React from 'react';
import './TruncateText.scss';

const TruncateText = ({value, keepLength = 8}) => {

	return (
		<React.Fragment>
			<div class="container-responsive-text">
				<span class="text">{`${value === '' ? '' : value.substring(0, keepLength) + '...'}`}</span>
			</div>
			<div class="container-full-text">
				{value}
			</div>
		</React.Fragment>
	);
};

export default TruncateText;