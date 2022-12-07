import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import { TableView, Screen, FormItem, TextBox, Checkbox, Dropdown, Button, StyledText } from 'src/components';
import { connect } from 'src/store';

export const Send = connect(state => ({
    currentAccount: state.account.current,
}))(function Send(props) {
    const { currentAccount } = props;

    return (
        <Screen
            bottomComponent={<Button title="Send" onPress={() => {}} />}
        >
            <ScrollView>
                <FormItem>
                    <StyledText type="title">Transfer</StyledText>
                </FormItem>
                <FormItem>
                    <TextBox title="Recipient" value={''} onChange={() => {}} />
                </FormItem>
                <FormItem>
                    <Dropdown title="Mosaic" value={''} list={[]} onChange={() => {}} />
                </FormItem>
                <FormItem>
                    <TextBox title="Amount" value={''} onChange={() => {}} />
                </FormItem>
                <FormItem>
                    <TextBox title="Message/Memo" value={''} onChange={() => {}} />
                </FormItem>
                <FormItem>
                    <Checkbox title="Encrypted" value={''} onChange={() => {}} />
                </FormItem>
                <FormItem>
                    <TextBox title="Fee" value={''} onChange={() => {}} />
                </FormItem>
            </ScrollView>
        </Screen>
    );
});
