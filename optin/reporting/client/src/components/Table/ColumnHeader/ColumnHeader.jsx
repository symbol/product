import React from 'react';
import './ColumnHeader.scss';

const ColumnHeader = props => {
	const toggleSort = React.useCallback(() => {
		let newDirection = 'desc' === props.sortDirection ? 'asc' : 'asc' === props.sortDirection ? 'none' : 'desc';
		props.onSort(props.field, newDirection);
	}, [props]);

	if (props.sortDirection) {
		const directionCls = 'asc' === props.sortDirection ? 'pi-sort-amount-down-alt' :
			'desc' === props.sortDirection ? 'pi-sort-amount-up' : 'pi-sort-alt';
		const headerCls = `p-sortable-column-icon pi pi-fw ${directionCls}`;
		return <div onClick={() => toggleSort()} role="button" aria-label={props.title} className="column-header-title">{props.title}
			<span className={headerCls} data-testid="sort-direction"></span></div>;
	}
	return <div>{props.title}</div>;
};

export default ColumnHeader;
