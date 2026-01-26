import {open, Scalar} from '@op-engineering/op-sqlite';
import {atom} from "jotai/index";
import {useAtom} from "jotai/react";
import {TranslationKey} from "../translations/translations.ts";
const db = open({
    name: 'aura.db',
});
db.execute('PRAGMA busy_timeout = 5000;');


export type Contact = {
    pubkey: string,
    name: string,
    is_blocked: boolean,
    is_muted: boolean,
    is_pinned: boolean,
    pow: number
}

export function defaultContact(pubkey: string, tr: (key: TranslationKey) => string){
    return {
        pubkey,
        name: tr('unknown'),
        pow: 8,
        is_blocked: false,
        is_pinned: false,
        is_muted: false,
    }
}

const _baseContacts = atom<Record<string, Contact>>({});

export const contactsAtom = atom(
    (get) => get(_baseContacts),

    async (get, set, update: { action: 'init' | 'add' | 'clear' | 'delete'; payload?: any }) => {
        const previousContacts = get(_baseContacts);
        switch (update.action) {
            case 'init': {
                const result = await db.execute('SELECT * FROM contacts');
                const rows = result.rows as unknown as Contact[];
                const map: Record<string, Contact> = {};
                if (rows) {
                    rows.forEach((c) => {
                        map[c.pubkey] = c;
                    });
                }
                set(_baseContacts, map);
                break;
            }

            case 'add': {
                const contact = update.payload as Contact;

                set(_baseContacts, (prev) => ({ ...prev, [contact.pubkey]: contact }));

                try {
                    await db.execute(
                        'INSERT OR REPLACE INTO contacts (pubkey, name, is_blocked, is_muted, is_pinned, pow) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            contact.pubkey,
                            contact.name,
                            contact.is_blocked ? 1 : 0,
                            contact.is_muted ? 1 : 0,
                            contact.is_pinned ? 1 : 0,
                            contact.pow
                        ]
                    );
                } catch (e) {
                    console.error("Failed to save contact, rolling back:", e);
                    set(_baseContacts, previousContacts);
                }
                break;
            }

            case 'delete': {
                const pubkey = update.payload;

                const newContacts = { ...previousContacts };
                delete newContacts[pubkey];
                set(_baseContacts, newContacts);

                try {
                    await db.execute('DELETE FROM contacts WHERE pubkey = ?', [pubkey]);
                } catch (e) {
                    console.error("Failed to delete contact, rolling back:", e);
                    set(_baseContacts, previousContacts);
                }
                break;
            }

            case 'clear': {
                set(_baseContacts, {});

                try {
                    await db.execute('DELETE FROM contacts');
                } catch (e) {
                    set(_baseContacts, previousContacts);
                }
                break;
            }
        }
    }
);

export function useContacts(): [Record<string, Contact>, (contact: Contact)=>void] {
    const [a,d] = useAtom(contactsAtom)
    return [a,
        (contact: Contact) => d({
        action: 'add',
        payload: contact
    })]
}