import React from 'react';
import { TableView, Screen, FormItem } from 'src/components';
import { connect } from 'src/store';

export const AccountDetails = connect(state => ({
    currentAccount: state.account.current,
}))(function AccountDetails(props) {
    const { currentAccount } = props;

    return (
        <Screen>
            <FormItem>
                <TableView data={currentAccount} />
            </FormItem>
        </Screen>
    );
});
