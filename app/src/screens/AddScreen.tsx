import useKeys from "../useKeys.ts";
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    Clipboard,
    Share,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    Vibration,
    Animated, NativeModules,
} from 'react-native';
import React, { useEffect, useState } from "react";
import useATheme, { Spacings, style_dim, style_h3 } from "../theme.ts";
import {useIsFocused, useNavigation} from "@react-navigation/core";
import { Nav } from "../../App.tsx";
import {DEEPLINK_PREFIX} from "../deeplink.ts";
import {useAtom} from "jotai/react";
import {useTranslation} from "../translations/translations.ts";
import Header from "../components/Header.tsx";
import {defaultContact, useContacts} from "../storage/contacts.ts";
import {channelsAtom} from "../storage/channels.ts";
import {targetBits} from "../components/PowSubHeader.tsx";
import {ScannerView} from "../components/ScannerView.tsx";
import {ContactData, ContactLink} from "../ContactLink.ts";

const { Aura } = NativeModules;

export default function AddScreen() {
    const [tr] = useTranslation();
    const nav = useNavigation<Nav>();
    const theme = useATheme();
    const [contacts, addContact] = useContacts();
    const [_, setChannels] = useAtom(channelsAtom);

    const isFocused = useIsFocused();
    const [validKeyFromClipboard, setValidKeyFromClipboard] = useState<ContactData | null>(null);

    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        Clipboard.getString().then(x=>{
            const linkInfo = ContactLink.parse(x)
            if(linkInfo){
                setValidKeyFromClipboard(linkInfo)
            }
            else{
                setValidKeyFromClipboard(null)
            }
        })
    }, [isFocused]);

    const handleAction = (info: ContactData) => {
        if (!contacts[info.pubkey]) {
            if(info.name) {
                addContact({...defaultContact(info.pubkey, tr), name: info.name});
            }
            else{
                addContact(defaultContact(info.pubkey, tr));
            }
        }
        nav.navigate("Chat", { publicKey: info.pubkey });
    };

    const onCodeScanned = (value: string) => {
        if (scanned) return;
        const linkInfo = ContactLink.parse(value);
        if(linkInfo){
            setScanned(true);
            Vibration.vibrate(10);
            handleAction(linkInfo);
        }
    };

    const handlePaste = () => {
        if (validKeyFromClipboard) handleAction(validKeyFromClipboard);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
            <Header>
                <Text style={[style_h3(theme), { fontSize: 18, fontWeight: '600' }]}>{tr("add_title")}</Text>
            </Header>

            <View style={styles.container}>
                <View>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.btnPrimary, { backgroundColor: theme.accent }]}
                        onPress={() => {
                            Aura.generateChannelKeypair().then(keypair => {
                                setChannels(x => ({ ...x, [keypair.publicKey]: keypair.privateKey }));
                                addContact({
                                    pubkey: '1'+keypair.publicKey,
                                    name: tr("unknown"),
                                    is_blocked: false, is_muted: false, is_pinned: false,
                                    pow: targetBits.broadcast.local,
                                });
                                nav.navigate("Chat", {publicKey: '1'+keypair.publicKey})
                            });
                        }}
                    >
                        <Text style={styles.btnTextPrimary}>+ {tr("add_channel")}</Text>
                    </TouchableOpacity>

                    <ScannerView onScan={onCodeScanned} theme={theme} tr={tr} />

                    <Text style={[style_dim(theme), { textAlign: 'center', marginTop: -10 }]}>
                        {tr("scan_tooltip")}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={!validKeyFromClipboard}
                        style={[
                            styles.btnSecondary,
                            { backgroundColor: theme.backgroundColor === '#000000' ? '#222' : '#EEE' },
                            !validKeyFromClipboard && { opacity: 0.3 }
                        ]}
                        onPress={handlePaste}
                    >
                        <Text style={[styles.btnTextSecondary, { color: theme.color }]}>
                            {validKeyFromClipboard ? tr("add_paste") : tr("add_paste_no")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: Spacings.major,
        paddingVertical: Spacings.minor,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: { alignItems: 'center' },
    container: {
        flex: 1,
        padding: Spacings.major,
        justifyContent: 'space-between',
    },
    qrContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 24,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    qrInner: { padding: 10, backgroundColor: '#FFF', borderRadius: 12 },
    monoKey: {
        marginTop: 20,
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    footer: { gap: 12, marginBottom: 20 },
    btnPrimary: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnTextPrimary: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
    btnSecondary: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnTextSecondary: { fontSize: 16, fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        elevation: 5,
    },
    modalOption: { paddingVertical: 15, width: '100%', alignItems: 'center' },
});
