import React from "react";
import {
    Platform,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { useAtom } from "jotai/react";
import useATheme, { style_dim } from "../theme.ts";
import { useTranslation } from "../translations/translations.ts";
import { contactsAtom } from "../storage/contacts.ts";
import { channelsAtom } from "../storage/channels.ts";
import { messagesAtom } from "../storage/messages.ts";
import useKeys from "../useKeys.ts";
import { DEEPLINK_PREFIX } from "../deeplink.ts";
import ContextMenu from "./ContextMenu.tsx";
import Aura from "./Aura.tsx";
import SmartDataShare from "./SmartDataShare.tsx";
import { confirmAlert } from "./ContactOptionsModal.tsx";

export default function ProfileModal({ isMenuVisible, setMenuVisible }) {
    const theme = useATheme();
    const scheme = useColorScheme();
    const [tr] = useTranslation();

    const { pub, regenerate } = useKeys();

    const [, contacts_dispatch] = useAtom(contactsAtom);
    const [, setChannels] = useAtom(channelsAtom);
    const [, messages_dispatch] = useAtom(messagesAtom);

    const handleResetAccount = () => {
        confirmAlert(tr, () => {
            regenerate();
            messages_dispatch({ type: "wipe" });
            contacts_dispatch({ action: "clear" });
            setChannels({});
            setMenuVisible(false);
        });
    };

    const renderHeader = (
        <View style={styles.headerContainer}>
            <View style={styles.innerPadding}>
                <View style={styles.profileInfo}>
                    <Aura
                        theme={scheme}
                        animate={true}
                        publicKey={"0" + pub}
                        size={96}
                    />
                    <View style={styles.textInfo}>
                        <Text style={[style_dim(theme), styles.label]}>
                            {tr("home_pub_key")}
                        </Text>
                        <Text style={[styles.pubkeyText, { color: theme.color }]}>
                            {pub ? "0" + pub.slice(0, 8) + "..." + pub.slice(-4) : ""}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.shareWrapper}>
                <SmartDataShare data={DEEPLINK_PREFIX + "0" + pub} />
            </View>
        </View>
    );

    return (
        <ContextMenu
            visible={isMenuVisible}
            onClose={() => setMenuVisible(false)}
            header={renderHeader}
            options={[
                {
                    title: tr("accopts_reset"),
                    action: handleResetAccount,
                    danger: true,
                },
            ]}
        />
    );
}
const styles = StyleSheet.create({
    headerContainer: {
        width: '100%',
        paddingVertical: 8,
    },
    innerPadding: {
        paddingHorizontal: 16,
    },
    profileInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
    },
    textInfo: {
        flex: 1,
    },
    label: {
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
        marginBottom: 2,
    },
    pubkeyText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    shareWrapper: {
        width: '100%',
        paddingHorizontal: 12,
        marginTop: -16,
    }
});