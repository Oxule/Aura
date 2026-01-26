import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    TouchableOpacity,
    NativeModules, Vibration, useColorScheme, ActivityIndicator, Linking, Clipboard
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {Nav, RootStackParamList} from "../../App.tsx";
import useATheme, { Spacings, Sizings, style_dim, style_h3, } from "../theme.ts";
import {useNavigation} from "@react-navigation/core";
import {useAtom} from "jotai/react";
import useKeys from "../useKeys.ts";
import ContactOptionsModal from "../components/ContactOptionsModal.tsx";
import {useTranslation} from "../translations/translations.ts";
import Header from '../components/Header.tsx';
import PowSubHeader, {targetBits} from "../components/PowSubHeader.tsx";
import {fromBase64, fromUtf8, toBase64, toUtf8} from "../utils.ts";
import {contactsAtom, useContacts} from "../storage/contacts.ts";
import {parsePubkey} from "./HomeScreen.tsx";
import {
  chatMessagesAtom,
  generateMessageHash,
  Message,
  messagesAtom,
  normalizeSentTime,
} from '../storage/messages.ts';
import {channelsAtom} from "../storage/channels.ts";

import AuraComp, { PRNG } from '../components/Aura.tsx';
import {sha256} from "js-sha256";

const { Aura } = NativeModules;

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route }: Props) {
    const [tr] = useTranslation()

    const theme = useATheme();
    const [input, setInput] = useState<string>("");

    const [contacts, addContact] = useContacts()

    const contact = contacts[route.params.publicKey]

    const {publicKey, type} = parsePubkey(route.params.publicKey)

    const [channels] = useAtom(channelsAtom)

    var privateKey: string | undefined
    if(type === "broadcast") {
        privateKey = channels[publicKey] as string | undefined
    }

    const canSend = (type === "direct" || (type === "broadcast" && privateKey))

    //console.log(channels, publicKey, privateKey)


    const { pub } = useKeys();

    const [isOptionsVisible, setOptionsVisible] = useState(false);

    useEffect(()=>{
        if(publicKey === pub){
            nav.navigate("Home")
        }
    }, [pub,route]);

    const [messages] = useAtom(chatMessagesAtom(route.params.publicKey))

    const [_b, messages_dispatch] = useAtom(messagesAtom)

    const nav = useNavigation<Nav>();

    const colorScheme = useColorScheme()

    function markAsRead(msg: string) {
        messages_dispatch({type: "read", payload: {hash: msg, contact: contact.pubkey}})
    }

    const viewabilityConfig = useRef({
        viewAreaCoveragePercentThreshold: 50,
        minimumViewTime: 500,
    }).current;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        viewableItems.forEach(({ item, isViewable }: {item: Message, isViewable: boolean}) => {
            if (isViewable && item.incoming && !item.read) {
                markAsRead(item.hash);
            }
        });
    }).current;

    const messages_list = useMemo(() => Object.entries(messages.messages).map(([_,y])=>y).sort((a,b)=>a.sent_time - b.sent_time).reverse(), [messages.messages]);

    if(contact === undefined || contact.pubkey === undefined){
        return <></>
    }

    const hashHex = sha256(route.params.publicKey);
    const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;
    const hue = (baseHue + 25) % 360
    const accent = `hsla(${hue}, 64%, 58%, 1)`
    //const accent = theme.accent
    //const answer = colorScheme === "dark" ? `hsla(${hue}, 30%, 10%, 1)` : `hsla(${hue}, 10%, 5%, 1)`

    const handleSend = async () => {
        const text = input.trim();
        if (text.length === 0) return;

        try {
            const t = Date.now()
            var msg: Message = {
                hash: "",
                content: toUtf8(text),
                contact: route.params.publicKey,
                incoming: false,
                sent_time: normalizeSentTime(t),
                arrive_time: t,
                read: true,
                status: "sending"
            }

            msg.hash = generateMessageHash(msg)

            messages_dispatch({type: "insert", payload: msg})
            setInput("");

            const pow = Math.max(contact?.pow??8,targetBits[type].local)

            if(type === "direct") {
                Aura.sendMessage(toBase64(toUtf8(text)), publicKey, pow, t).then(x=>{
                    if(x === true){
                        msg.status = "sent"
                        messages_dispatch({type: "insert", payload: msg})
                    }
                }).catch(e=>{
                    msg.status = "error"
                    messages_dispatch({type: "insert", payload: msg})
                })
            }
            else if(type === "broadcast"){
                Aura.sendChannelMessage(toBase64(toUtf8(text)), pow, privateKey, t).then(x=>{
                    if(x === true){
                        msg.status = "sent"
                        messages_dispatch({type: "insert", payload: msg})
                    }
                }).catch(e=>{
                    msg.status = "error"
                    messages_dispatch({type: "insert", payload: msg})
                })
            }
        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = !item.incoming;

        const renderStatusIcon = () => {
            if (!isMe) return null;
            switch (item.status) {
                case 'sending':
                    return <ActivityIndicator size={10} color="#fff" style={{ marginLeft: 4 }} />;
                case 'sent':
                    return <Text style={styles.statusCheckmark}>{'✓'}</Text>;
                case 'error':
                    return <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: 'bold' }}>!</Text>;
                default:
                    return null;
            }
        };

        const bubbleStyle = [
            styles.bubble,
            isMe ? {
                backgroundColor: accent,
                borderBottomRightRadius: 4,
                alignSelf: 'flex-end',
            } : {
                backgroundColor: theme.backgroundColor === '#000000' ? '#212121' : '#FFFFFF',
                borderBottomLeftRadius: 4,
                alignSelf: 'flex-start',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1,
                elevation: 1,
            }
        ];

        const text = fromUtf8(item.content);

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);

        return (
            <TouchableOpacity activeOpacity={0.6} delayLongPress={300} onLongPress={()=>{
                Clipboard.setString(text);
                Vibration.vibrate(30)
            }} style={[styles.bubbleContainer, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
                <View style={[
                    //@ts-ignore
                    bubbleStyle
                ]}>
                    <View style={styles.contentWrapper}>
                        {parts.map((part, index) => {
                            if (part.match(urlRegex)) {
                                return (
                                    <Text
                                        key={index}
                                        style={[styles.messageText,{ color: '#ffffff', textDecorationLine: 'underline' }]}
                                        onPress={() => Linking.openURL(part)}
                                    >
                                        {part}
                                    </Text>
                                );
                            }
                            return <Text style={[styles.messageText, { color: isMe ? '#FFF' : theme.color }]}>{part}</Text>;
                        })}
                        <Text style={{ fontSize: 12 }}> </Text>

                        <View style={styles.timeContainer}>
                            <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : '#8E8E93' }]}>
                                {new Date(item.sent_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {renderStatusIcon()}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
            <ContactOptionsModal
                isVisible={isOptionsVisible}
                onClose={() => setOptionsVisible(false)}
                publicKey={route.params.publicKey}
                showMarkRead={false}
            />

            <Header>
                <TouchableOpacity
                onPress={() => setOptionsVisible(true)}
                hitSlop={{ top: 32, bottom: 32, left: 32, right: 32 }}
            >
                    <View style={{display: "flex", flexDirection: "row", alignItems: "center", gap: 8}}>
                        <AuraComp theme={colorScheme} size={64} publicKey={route.params.publicKey} />
                        <View>
                            <Text style={{ color: theme.color, fontSize: 18, fontWeight: 'bold' }}>
                                {contact.name}
                            </Text>,
                            <Text style={[style_dim(theme), { fontSize: 10, marginTop: 4 }]}>
                                {publicKey.slice(0, 8)}...{publicKey.slice(-4)}
                            </Text>
                        </View>
                    </View>
            </TouchableOpacity>
            </Header>
            {canSend && <PowSubHeader
                profile={type}
                bits={contact?.pow}
                setBits={(b: number) => {
                    Vibration.vibrate(10);
                    addContact({...contact, pow: b})
                }}
                theme={theme}
            />}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
                style={{ flex: 1 }}
            >
                <FlatList
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    data={messages_list}
                    renderItem={renderItem}
                    keyExtractor={item => item.hash}
                    contentContainerStyle={{ paddingBottom: 10 }}
                    inverted={true}
                    showsVerticalScrollIndicator={false}
                />

                {canSend &&
                    <View style={[styles.inputContainer, { backgroundColor: theme.backgroundColor, borderTopColor: theme.dim + '30' }]}>
                    <TextInput
                        style={[
                            styles.inputField,
                            {
                                color: theme.color,
                                backgroundColor: theme.backgroundColor === '#000000' ? '#1C1C1E' : '#F2F2F7',
                                borderColor: theme.dim + '40'
                            }
                        ]}
                        placeholder={tr("chat_message_placeholder")}
                        placeholderTextColor={theme.dim}
                        value={input}
                        onChangeText={setInput}
                        multiline
                    />

                    {
                        input.trim().length > 0 &&
                        <TouchableOpacity
                            onPress={handleSend}
                            /*onLongPress={() => {
                                Vibration.vibrate(15);
                            }}
                            delayLongPress={100}*/
                            activeOpacity={0.7}
                            disabled={input.trim().length === 0}
                            style={[
                                styles.sendButton,
                                {backgroundColor: accent}
                            ]}
                        >
                            <Text style={{ color: '#FFF', fontSize: 32,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 32,
                                marginTop: -4,
                            }}>↑</Text>
                        </TouchableOpacity>
                    }
                </View>
                }
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    bubbleContainer: {
        marginVertical: 2,
        maxWidth: '85%',
        paddingHorizontal: 10,
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        minWidth: 60,
        position: 'relative',
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
    },
    messageContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 11,
    },
    statusCheckmark: {
        color: '#fff',
        fontSize: 11,
        marginLeft: 3,
        fontWeight: '300',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: 'transparent',
    },
    inputField: {
        flex: 1,
        minHeight: 40,
        maxHeight: 150,
        borderRadius: 22,
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 17,
        backgroundColor: '#212121',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 2,
    },
    contentWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
    },
});