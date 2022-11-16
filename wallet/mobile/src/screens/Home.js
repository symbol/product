import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountCard, Button, Screen, TextBox, FormItem } from 'src/components';

export const Home = () => {
    const [text1, setText1] = useState('Recomended');
    const [text2, setText2] = useState('');

    return (
        <Screen>
            <FormItem>
                <AccountCard 
                    name="Account 1" 
                    address="NAPTCRRHCQI3FJ52Q7RU5RCLUQNNXUARSSRDDNY" 
                    balance={12001.34}
                    ticker="XYM"
                    onReceivePress={() => console.log('receive')}
                    onSendPress={() => console.log('Send')}
                    onScanPress={() => console.log('Scan')}
                />
            </FormItem>
            <FormItem>
                <TextBox title="Fee" value={text1} onChange={setText1}/>
            </FormItem>
            <FormItem>
                <TextBox title="Test and others" value={text2} onChange={setText2} />
            </FormItem>
            <FormItem>
                <Button title="Test" onPress={() => {}} />
            </FormItem>
            <FormItem>
                <Button isDisabled title="Disabled" onPress={() => {}}/>
            </FormItem>
        </Screen>
    );
};

const styles = StyleSheet.create({
    but: {
        height: 30,
        width: 30,
        backgroundColor: '#f005'
    }
});
