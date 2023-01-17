import React, { useState } from 'react';
import { Screen, FormItem, Button, ItemContact, TabView } from 'src/components';
import { connect } from 'src/store';
import { Router } from 'src/Router';
import { layout } from 'src/styles';
import { FlatList } from 'react-native-gesture-handler';
import _ from 'lodash';

export const AddressBookList = connect(state => ({
    addressBookWhiteList: state.addressBook.whiteList,
    addressBookBlackList: state.addressBook.blackList,
}))(function AddressBookList(props) {
    const { addressBookWhiteList, addressBookBlackList } = props;
    const [list, setList] = useState('whitelist');
    const tabs = [{
        label: 'Whitelist',
        value: 'whitelist',
        content: <FlatList
            contentContainerStyle={layout.listContainer}
            data={addressBookWhiteList}
            keyExtractor={(item) => 'contact' + item.id} 
            renderItem={({item}) => <ItemContact contact={item} onPress={() => Router.goToAddressBookContact(item)} />} 
        />
    }, {
        label: 'Blacklist',
        value: 'blacklist',
        content: <FlatList
            contentContainerStyle={layout.listContainer}
            data={addressBookBlackList}
            keyExtractor={(item) => 'contact' + item.id} 
            renderItem={({item}) => <ItemContact contact={item} onPress={() => Router.goToAddressBookContact(item)} />} 
        />
    }];

    return (
        // notranslate
        <Screen bottomComponent={<>
            <FormItem>
                <Button 
                    title="Add Contact" 
                    onPress={() => Router.goToAddressBookAddContact({list})} 
                />
            </FormItem>
        </>}>
            <TabView tabs={tabs} onChange={setList} />
        </Screen>
    );
});
