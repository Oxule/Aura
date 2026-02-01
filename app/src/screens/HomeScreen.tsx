import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    Vibration,
    useColorScheme,
} from 'react-native';
import { useNavigation } from "@react-navigation/core";
import { Nav } from "../../App.tsx";
import useATheme, { style_dim } from "../theme.ts";
import useKeys from "../useKeys.ts";
import { useTranslation } from "../translations/translations.ts";
import Header from "../components/Header.tsx";
import { Contact, contactsAtom, useContacts } from "../storage/contacts.ts";
import { Message, messagesAtom, useMessages } from "../storage/messages.ts";
import { fromUtf8 } from "../utils.ts";
import Aura from "../components/Aura.tsx";
import ContactModal from "../components/ContactModal.tsx";
import {Megaphone, MessageCircleMore, Pin, Settings, VolumeOff} from "lucide-react-native";

export function parsePubkey(pubkey: string): { publicKey: string, type: "direct" | "broadcast" } {
    return {
        publicKey: pubkey.slice(1, pubkey.length),
        type: pubkey[0] === "0" ? "direct" : "broadcast"
    }
}

export default function HomeScreen() {
    const [tr] = useTranslation();
    const { pub } = useKeys();
    const theme = useATheme();
    const nav = useNavigation<Nav>();

    const [contacts] = useContacts();

    const [messages] = useMessages();

    const {pub: userPubkey} = useKeys();

    const [selectedContactKey, setSelectedContactKey] = useState<string | null>(null);

    const colorScheme = useColorScheme()

    const chats = useMemo(() => {
        return Object.entries(contacts)
            .map(([k, v]) => {
                const chatMessages = messages[k]?.messages;
                const messagesArray = chatMessages ? Object.values(chatMessages) : [];

                const lastMessage = messagesArray.length > 0
                    ? messagesArray.reduce((prev, curr) =>
                        // @ts-ignore
                        curr.sent_time > prev.sent_time ? curr : prev
                    )
                    : undefined;

                const unreadCount = messagesArray.reduce((count, msg) => {
                    // @ts-ignore
                    return count + (!msg.read && msg.incoming ? 1 : 0);
                }, 0);

                return {
                    contact: v,
                    lastMessage: lastMessage as Message | undefined,
                    unreadCount
                };
            })
            .sort((a, b) => {
                if (a.contact.is_pinned !== b.contact.is_pinned) {
                    return a.contact.is_pinned ? -1 : 1;
                }

                const timeA = a.lastMessage?.sent_time || 0;
                const timeB = b.lastMessage?.sent_time || 0;

                return timeB - timeA;
            });
    }, [contacts, messages]);

    const renderItem = ({ item }: { item: { contact: Contact; lastMessage: Message | undefined; unreadCount: number } }) => {
        const { contact, lastMessage, unreadCount} = item;
        if(contact === null || contact.pubkey === null || contact.pubkey === undefined){
            return <></>
        }
        const { type } = parsePubkey(contact.pubkey);

        let messagePreview = tr("no_messages_yet");
        if (lastMessage) {
            try {
                messagePreview = fromUtf8(lastMessage.content);
            } catch (e) {
                messagePreview = "[Binary Data]";
            }
        }

        return (
            <TouchableOpacity
                style={[
                    styles.contactRow,
                    { borderBottomColor: theme.dim + '15' },
                    contact.is_muted && { opacity: 0.6 }
                ]}
                onPress={() => nav.navigate('Chat', { publicKey: contact.pubkey })}
                onLongPress={() => {
                    Vibration.vibrate(10);
                    setSelectedContactKey(contact.pubkey);
                }}
                delayLongPress={200}
            >
                <View style={{flex: 1, flexDirection: "row", justifyContent: "flex-start", alignItems: "center", gap: 12}}>
                    <Aura size={64} animate={false} theme={colorScheme} publicKey={contact.pubkey}/>

                    <View style={styles.contactInfo}>
                    <View style={styles.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            {type === "direct" ? <MessageCircleMore style={{color: theme.color, marginRight: 8 }}/> : <Megaphone style={{color: theme.color, marginRight: 8 }}/>}
                            {contact.is_pinned && <Pin style={{color: theme.color, marginRight: 8 }}/>}
                            {contact.is_muted && <VolumeOff style={{color: theme.color, marginRight: 8 }}/>}
                            <Text numberOfLines={1} style={[styles.contactName, { color: theme.color }]}>
                                {contact.name || tr("unknown")}
                            </Text>
                        </View>

                        {lastMessage && (
                            <Text style={[style_dim(theme), { fontSize: 11 }]}>
                                {new Date(lastMessage.sent_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </View>

                    <View style={[styles.rowBetween, { marginTop: 4 }]}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text
                                numberOfLines={1}
                                style={[
                                    style_dim(theme),
                                    { fontSize: 14 },
                                    !lastMessage && { fontStyle: 'italic', opacity: 0.5 }
                                ]}
                            >
                                {item.contact.is_blocked ? "🚫 " + tr("blocked") : messagePreview}
                            </Text>
                        </View>
                        {unreadCount > 0 && (
                            <View style={[styles.unreadBadge, { backgroundColor: theme.accent }]}>
                                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
            <ContactModal pubkey={selectedContactKey} visible={selectedContactKey!==null} onClose={()=>setSelectedContactKey(null)}/>

            {/*@ts-ignore*/}
            <Header left={<TouchableOpacity hitSlop={32} onPress={() => nav.navigate("Settings")}><Settings style={{ color: theme.color, fontSize: 28 }}/></TouchableOpacity>}
                right={<TouchableOpacity hitSlop={32} onPress={() => nav.navigate("Add")}><Text style={{ color: theme.accent, fontSize: 28 }}>＋</Text></TouchableOpacity>}
            >
                <TouchableOpacity hitSlop={32} onPress={() => setSelectedContactKey("0"+userPubkey)}>
                    <View style={{display: "flex", flexDirection: "row", alignItems: "center", gap: 8}}>
                        <Aura theme={colorScheme} size={64} publicKey={"0"+pub} />
                        <View>
                            <Text style={[style_dim(theme), { fontSize: 10, textTransform: 'uppercase' }]}>{tr("home_pub_key")}</Text>
                            <Text style={{ color: theme.color, fontWeight: '600' }}>{pub ? `${pub.slice(0, 8)}...${pub.slice(-4)}` : "..."}</Text>
                        </View>
                    </View>
                    </TouchableOpacity>
            </Header>
            
            <FlatList
                //@ts-ignore
                data={chats}
                keyExtractor={(item) => item.contact.pubkey}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[style_dim(theme), { textAlign: 'center' }]}>{tr("home_no_contacts")}</Text>
                    </View>
                }
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerCenter: { alignItems: 'center' },
    contactRow: { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5 },
    contactInfo: { flex: 1 },
    contactName: { fontSize: 17, fontWeight: '600' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    emptyContainer: { marginTop: 100, paddingHorizontal: 40 },
});