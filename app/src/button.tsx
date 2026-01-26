import useATheme from "./theme.ts";
import {StyleSheet, Text, TouchableOpacity} from "react-native";

export const AButton = ({ title, onPress, inactive, type, style }: { title: string; inactive?: boolean; type: "primary"|"secondary"; onPress: () => void; style?: any }) => {
    const theme = useATheme();

    if(inactive){
        return <Text style={[styles.btn, { color: theme.backgroundColor, backgroundColor: theme.dim }, style]}>{title}</Text>
    }

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.btn, { backgroundColor: type==="primary" ? theme.accent : theme.color}, style]}
            onPress={onPress}
        >
            <Text style={[type==="primary"?styles.btnTextPrimary:styles.btnTextSecondary, { color: type==="primary"?theme.color:theme.backgroundColor }]}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    btn: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16
    },
    btnTextPrimary: {color: '#FFF', fontSize: 17, fontWeight: 'bold'},
    btnTextSecondary: {fontSize: 16, fontWeight: '600'}
})