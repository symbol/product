import React from 'react';
import { Screen, FormItem, Button, StyledText, ItemContact } from 'src/components';
import { connect } from 'src/store';
import { Router } from 'src/Router';
import { useState } from 'react';
import { useMemo } from 'react';
import { FlatList } from 'react-native-gesture-handler';
import _ from 'lodash';

export const AddressBookList = connect(state => ({
    addressBook: state.addressBook.addressBook,
}))(function AddressBookList(props) {
    const { addressBook } = props;
    const [list, setList] = useState('whitelist');
    const contacts = useMemo(() => list === 'whitelist' 
        ? _.orderBy(addressBook.getWhiteListedContacts(), ['name'], ['asc'])
        : _.orderBy(addressBook.getBlackListedContacts(), ['name'], ['asc'])
    [list])

    return (
        // notranslate
        <Screen bottomComponent={<>
            <FormItem>
                <Button title="Add Contact" onPress={() => Router.goToAddressBookAddContact({list})} />
            </FormItem>
        </>}>
            <FormItem>
                {/* notranslate */}
                <StyledText type="title">Whitelist | Blacklist</StyledText>
            </FormItem>
            
            <FlatList
                data={contacts}
                keyExtractor={(item, index) => 'contact' + index} 
                renderItem={({item}) => (
                    <ItemContact contact={item} />
            )} />
        </Screen>
    );
});
