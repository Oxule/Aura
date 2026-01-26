import {useAtom} from "jotai/react";
import {chatMessagesAtom, Message, messagesAtom} from "../../storage/messages.ts";
import React, {useMemo, useRef} from "react";
import {
    ActivityIndicator,
    Clipboard,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity, useColorScheme,
    Vibration,
    View
} from "react-native";
import {fromUtf8} from "../../utils.ts";
import useATheme from "../../theme.ts";

export default function MessagesList({pubkey, accent, color}:{pubkey: string, accent: string,color:string}){
    const [messages] = useAtom(chatMessagesAtom(pubkey))

    const messages_list = useMemo(() => Object.entries(messages.messages).map(([_,y])=>y).sort((a,b)=>a.sent_time - b.sent_time).reverse(), [messages.messages]);

    const theme = useATheme()

    const scheme = useColorScheme()

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = !item.incoming;

        const bg = isMe ? accent : (scheme === "dark"? '#212121' : '#FFFFFF')
        const col = isMe ? color : (scheme === "dark"? 'white' : 'black')

        const renderStatusIcon = () => {
            if (!isMe) return null;
            switch (item.status) {
                case 'sending':
                    return <ActivityIndicator size={10} color={col} style={{ marginLeft: 4 }} />;
                case 'sent':
                    return <Text style={[styles.statusCheckmark,{color: col}]}>{'✓'}</Text>;
                case 'error':
                    return <Text style={{ color: col, fontSize: 12, fontWeight: 'bold' }}>!</Text>;
                default:
                    return null;
            }
        };

        const bubbleStyle = [
            styles.bubble,
            {
                backgroundColor: bg
            },
            isMe ? {
                borderBottomRightRadius: 4,
                alignSelf: 'flex-end',
            } : {
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
                                        style={[styles.messageText,{ color: col, textDecorationLine: 'underline' }]}
                                        onPress={() => Linking.openURL(part)}
                                    >
                                        {part}
                                    </Text>
                                );
                            }
                            return <Text style={[styles.messageText, { color: col }]}>{part}</Text>;
                        })}
                        <Text style={{ fontSize: 12 }}> </Text>

                        <View style={styles.timeContainer}>
                            <Text style={[styles.timeText, { color: col + "90" }]}>
                                {new Date(item.sent_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {renderStatusIcon()}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const [_b, messages_dispatch] = useAtom(messagesAtom)

    function markAsRead(msg: string) {
        messages_dispatch({type: "read", payload: {hash: msg, contact: pubkey}})
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

    return <FlatList
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        data={messages_list}
        renderItem={renderItem}
        keyExtractor={item => item.hash}
        contentContainerStyle={{ paddingBottom: 10 }}
        inverted={true}
        showsVerticalScrollIndicator={false}
    />
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
        fontSize: 11,
        marginLeft: 3,
        fontWeight: '300',
    },
    contentWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
    },
});