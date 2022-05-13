import PopUpDialog from '../PopUpDialog';
import React from 'react';
import './ResponsiveList.scss';

const ResponsiveList = props => {

	return (
		<React.Fragment>
			<div className="container-full-list">
				{React.Children.toArray(props.children)}
			</div>
			<div className="container-responsive-list">
				<div className="container-responsive-list-visible">
					{props.visible ?? (props.children[0] || '')}
				</div>
				{
					1 < props.children.length &&
					<div className="container-responsive-list-more">
						<PopUpDialog content={props.children} buttonText={props.showMoreText ?? 'more'} title={props.title ?? 'more'}/>
					</div>
				}
			</div>
		</React.Fragment>
	);
};

export default ResponsiveList;
