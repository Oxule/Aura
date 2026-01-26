import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import useATheme, {Spacings, style_dim, style_h3} from "../theme.ts";
import React, {JSX} from "react";
import {useNavigation} from "@react-navigation/core";
import {Nav} from "../../App.tsx";

export default function Header({children, left, right}: {children: JSX.Element, left?: JSX.Element, right?: JSX.Element}) {
    const theme = useATheme();
    const nav = useNavigation<Nav>();

    const l = left !== undefined ? left : (nav.canGoBack() ? <TouchableOpacity
        onPress={()=>{nav.goBack()}}
        hitSlop={32}
    >
        <Text style={{ color: theme.color, fontSize: 48,
            height: 32,
            width: 48,
            fontWeight: 'bold',
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
            verticalAlign: "top",
            lineHeight: 18,
            marginTop: 0,
            /*backgroundColor: "blue"*/
        }}>←</Text>
    </TouchableOpacity> : <View style={{width:48,height:32}}/>)

    const r = right !== undefined ? right : <View style={{width:48,height:32}}/>

    return <View style={[styles.header, { borderBottomColor: theme.dim + '30' }]}>
        {l}
        {children}
        {r}
    </View>
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: Spacings.major,
        paddingVertical: Spacings.minor,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    headerContent: {
        alignItems: 'center',
    },
});