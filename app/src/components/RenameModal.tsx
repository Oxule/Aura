import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  TouchableWithoutFeedback,
} from 'react-native';
import useATheme from "../theme.ts";
import {useTranslation} from "../translations/translations.ts";

export default function RenameModal({ visible, initialName, onSave, onClose, accent }) {
    const theme = useATheme();
    const [name, setName] = useState(initialName);
    const [tr] = useTranslation()

    useEffect(() => {
        if (visible) setName(initialName);
    }, [visible, initialName]);

    const handleSave = () => {
        if (name.trim().length > 0) {
            Vibration.vibrate(10);
            onSave(name.trim());
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.overlay}
            >
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={{flex: 1}} />
                </TouchableWithoutFeedback>
                <View style={[styles.content, { backgroundColor: theme.backgroundColor, borderColor: theme.dim + "30" }]}>
                    <Text style={[styles.label, { color: theme.dim }]}>{tr("rename")}</Text>

                    <TextInput
                        style={[styles.input, { color: theme.color, borderBottomColor: accent }]}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        placeholderTextColor={theme.dim + "80"}
                        selectionColor={accent}
                    />

                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={styles.btn}>
                            <Text style={{ color: theme.dim }}>{tr("cancel")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            style={[styles.saveBtn, { backgroundColor: accent }]}
                        >
                            <Text style={styles.saveBtnText}>{tr("save")}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        borderWidth: 1,
        borderBottomWidth: 0,
        elevation: 25,
    },
    label: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    input: {
        fontSize: 24,
        fontWeight: 'bold',
        paddingVertical: 12,
        borderBottomWidth: 2,
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    btn: {
        padding: 12,
    },
    saveBtn: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 100,
    },
    saveBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    }
});