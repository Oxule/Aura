import {atom} from "jotai";
import {atomFamily} from "jotai-family";
import {open} from "@op-engineering/op-sqlite";
import {sha256} from "js-sha256";
import {toBase64, toUtf8} from "../utils.ts";
import {toByteArray} from "base64-js";
import {useAtom} from "jotai/react";

const db = open({
    name: 'aura.db',
});

export type Message = {
    hash: string;
    contact: string;
    content: Uint8Array;
    sent_time: number;
    arrive_time: number;
    read: boolean;
    incoming: boolean;
    status: "sending"|"sent"|"error"
};

export const mapNativeMessage = (nativeMsg: any): Message => {
    return {
        ...nativeMsg,
        read: nativeMsg.read === 1,
        content: typeof nativeMsg.content === 'string'
            ? toByteArray(nativeMsg.content)
            : nativeMsg.content,
        sent_time: Math.floor(nativeMsg.sent_time),
        arrive_time: Math.floor(nativeMsg.arrive_time),
    };
};

export function normalizeSentTime(unixMs: number): number {
    const seconds = Math.floor(unixMs / 1000);
    const msecsFraction = Math.floor((unixMs % 1000) / 4);
    return (seconds * 1000) + (msecsFraction * 4);
}

export function generateMessageHash(msg: Omit<Message, 'hash'>): string {
    const contentBase64 = toBase64(msg.content);
    const input = msg.contact + contentBase64 + normalizeSentTime(msg.sent_time).toString();
    const hashBytes = sha256.array(toUtf8(input));
    const hash = toBase64(new Uint8Array(hashBytes));
    return hash;
}

const messagesStoreAtom = atom<Record<string, { messages: Record<string, Message> }>>({});

export const chatMessagesAtom = atomFamily((pubKey: string) => atom(
    (get) => get(messagesStoreAtom)[pubKey] || { messages: {} }
));

export const messagesAtom = atom(
    null,
    async (get, set, action: {
        type: 'load' | 'receive' | 'insert' | 'read' | 'delete' | 'wipe' | 'readall';
        payload?: any
    }) => {
        const previousStore = get(messagesStoreAtom);

        switch (action.type) {
            case 'load': {
                const { mode, contact, from, to } = action.payload;
                let query = 'SELECT * FROM messages';
                const params: any[] = [];

                if (mode === 'byContact' && contact) {
                    query += ' WHERE contact = ? ORDER BY sent_time ASC';
                    params.push(contact);
                } else if (mode === 'range' && contact) {
                    query += ' WHERE contact = ? AND sent_time BETWEEN ? AND ? ORDER BY sent_time ASC';
                    params.push(contact, from, to);
                }

                const result = await db.execute(query, params);
                const rows = (result.rows as unknown as any[]).map(x => ({
                    ...x,
                    read: x.read === 1,
                    incoming: x.incoming === 1,
                    content: x.content && x.content.byteLength !== undefined
                        ? new Uint8Array(x.content)
                        : (typeof x.content === 'string' ? toByteArray(x.content) : new Uint8Array())
                })) as Message[];

                const newStore = { ...previousStore };
                rows.forEach(msg => {
                    if (!newStore[msg.contact]) newStore[msg.contact] = { messages: {} };
                    newStore[msg.contact].messages[msg.hash] = msg;
                });
                set(messagesStoreAtom, newStore);
                break;
            }

            case 'receive': {
                const msg = action.payload as Message;
                const contact = msg.contact;
                const currentChat = previousStore[contact] || { messages: {} };

                if(currentChat.messages[msg.hash] === undefined) {
                    set(messagesStoreAtom, {
                        ...previousStore,
                        [contact]: {
                            messages: {...currentChat.messages, [msg.hash]: msg}
                        }
                    });
                }
                break;
            }

            case 'insert': {
                const msg = action.payload as Message;
                set(messagesStoreAtom, {
                    ...previousStore,
                    [msg.contact]: {
                        messages: { ...(previousStore[msg.contact]?.messages || {}), [msg.hash]: msg }
                    }
                });

                try {
                    await db.execute(
                        'INSERT OR REPLACE INTO messages (hash, contact, content, sent_time, arrive_time, read, incoming, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [msg.hash, msg.contact, msg.content, msg.sent_time, msg.arrive_time, msg.read ? 1 : 0, msg.incoming ? 1 : 0, msg.status]
                    );
                } catch (e) {
                    set(messagesStoreAtom, previousStore);
                }
                break;
            }

            case 'read': {
                const { contact, hash } = action.payload;
                if (previousStore[contact]?.messages[hash]) {
                    const updatedMsg = { ...previousStore[contact].messages[hash], read: 1 };
                    set(messagesStoreAtom, {
                        ...previousStore,
                        [contact]: {
                            messages: { ...previousStore[contact].messages, [hash]: updatedMsg }
                        }
                    });
                }

                try {
                    await db.execute('UPDATE messages SET read = 1 WHERE hash = ?', [hash]);
                } catch (e) {
                    set(messagesStoreAtom, previousStore);
                }
                break;
            }

            case 'readall': {
                const { contact } = action.payload;
                if (previousStore[contact]) {
                    const updatedMessages = { ...previousStore[contact].messages };
                    Object.keys(updatedMessages).forEach(hash => {
                        if (!updatedMessages[hash].read) {
                            updatedMessages[hash] = { ...updatedMessages[hash], read: true };
                        }
                    });

                    set(messagesStoreAtom, {
                        ...previousStore,
                        [contact]: {
                            ...previousStore[contact],
                            messages: updatedMessages
                        }
                    });
                }

                try {
                    await db.execute('UPDATE messages SET read = 1 WHERE contact = ? AND incoming = 1', [contact]);
                } catch (e) {
                    set(messagesStoreAtom, previousStore);
                }
                break;
            }

            case 'delete': {
                const { contact, hash, all } = action.payload;
                if (all) {
                    const { [contact]: _, ...remainingStore } = previousStore;
                    set(messagesStoreAtom, remainingStore);
                    try {
                        await db.execute('DELETE FROM messages WHERE contact = ?', [contact]);
                    } catch (e) {
                        set(messagesStoreAtom, previousStore);
                    }
                } else {
                    const currentChat = previousStore[contact];
                    if (currentChat) {
                        const { [hash]: _, ...remainingMsgs } = currentChat.messages;
                        set(messagesStoreAtom, { ...previousStore, [contact]: { messages: remainingMsgs } });
                    }
                    try {
                        await db.execute('DELETE FROM messages WHERE hash = ?', [hash]);
                    } catch (e) {
                        set(messagesStoreAtom, previousStore);
                    }
                }
                break;
            }

            case 'wipe': {
                set(messagesStoreAtom, {});
                try {
                    await db.execute('DELETE FROM messages');
                } catch (e) {
                    set(messagesStoreAtom, previousStore);
                }
                break;
            }
        }
    }
);

export function useMessages(){
    const [_, messages_dispatch] = useAtom(messagesAtom);
    const [messages] = useAtom(messagesStoreAtom);

    return [
        messages,
        (msg: Message) => messages_dispatch({type: "insert", payload: msg}),
        (msg: Message) => messages_dispatch({type: "read", payload: { contact: msg.contact, hash: msg.hash }})
    ];
}