import {NativeModules, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {parsePubkey} from "../HomeScreen.tsx";
import useATheme from "../../theme.ts";
import {useState} from "react";
import {useTranslation} from "../../translations/translations.ts";
import {generateMessageHash, Message, messagesAtom, normalizeSentTime} from "../../storage/messages.ts";
import {toBase64, toUtf8} from "../../utils.ts";
import {targetBits} from "../../components/PowSubHeader.tsx";
import {useAtom} from "jotai/react";
import {channelsAtom} from "../../storage/channels.ts";

const { Aura } = NativeModules;

export default function Send({pubkey, bits, accent, color}: {pubkey:string,bits:number,accent:string,color:string}) {
    const {publicKey, type} = parsePubkey(pubkey)
    const theme = useATheme()

    const [tr] = useTranslation()

    const [_b, messages_dispatch] = useAtom(messagesAtom)

    const [channels] = useAtom(channelsAtom)

    var privateKey: string | undefined
    if(type === "broadcast") {
        privateKey = channels[publicKey] as string | undefined
    }

    const [input, setInput] = useState<string>("");

    const handleSend = async () => {
        const text = input.trim();
        if (text.length === 0) return;

        try {
            setInput("");

            const t = Date.now()
            var msg: Message = {
                hash: "",
                content: toUtf8(text),
                contact: pubkey,
                incoming: false,
                sent_time: normalizeSentTime(t),
                arrive_time: t,
                read: true,
                status: "sending"
            }

            msg.hash = generateMessageHash(msg)

            setTimeout(() => {

                messages_dispatch({type: "insert", payload: msg})

            }, 0);

            setTimeout(() => {
                const pow = Math.max(bits ?? 8, targetBits[type].local)

                if (type === "direct") {
                    Aura.sendMessage(toBase64(toUtf8(text)), publicKey, pow, t).then(x => {
                        if (x === true) {
                            msg.status = "sent"
                            messages_dispatch({type: "insert", payload: msg})
                        }
                    }).catch(e => {
                        msg.status = "error"
                        messages_dispatch({type: "insert", payload: msg})
                    })
                } else if (type === "broadcast") {
                    Aura.sendChannelMessage(toBase64(toUtf8(text)), pow, privateKey, t).then(x => {
                        if (x === true) {
                            msg.status = "sent"
                            messages_dispatch({type: "insert", payload: msg})
                        }
                    }).catch(e => {
                        msg.status = "error"
                        messages_dispatch({type: "insert", payload: msg})
                    })
                }
            }, 100);
        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    return <View style={[styles.inputContainer, { backgroundColor: theme.backgroundColor, borderTopColor: theme.dim + '30' }]}>
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
                activeOpacity={0.7}
                disabled={input.trim().length === 0}
                style={[
                    styles.sendButton,
                    {backgroundColor: accent}
                ]}
            >
                <Text style={{ color: color, fontSize: 32,
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

const styles = StyleSheet.create({
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
    }
});