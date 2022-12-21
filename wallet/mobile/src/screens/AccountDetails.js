import React from 'react';
import { TableView, Screen, FormItem } from 'src/components';
import { connect } from 'src/store';

export const AccountDetails = connect(state => ({
    currentAccount: state.account.current,
}))(function AccountDetails(props) {
    const { currentAccount } = props;
    const tableData = {};
    
    delete Object.assign(tableData, currentAccount, {['seedIndex']: currentAccount['index'] })['index'];

    return (
        <Screen>
            <FormItem>
                <TableView data={tableData} />
            </FormItem>
        </Screen>
    );
});
