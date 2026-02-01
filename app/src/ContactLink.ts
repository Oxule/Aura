import {DEEPLINK_PREFIX} from "./deeplink.ts";
import {fromBase64, fromUtf8, toBase64, toUtf8} from "./utils.ts";

export interface ContactData {
    pubkey: string;
    name?: string;
}

export class ContactLink {
    private static readonly PREFIX = DEEPLINK_PREFIX;

    static serialize({ pubkey, name }: ContactData): string {
        let link = `${this.PREFIX}${pubkey}`;

        if (name) {
            const n = toBase64(toUtf8(name));
            link += `#${n}`;
        }

        return link;
    }

    static parse(link: string): ContactData | undefined {
        if (!link || !link.startsWith(this.PREFIX)) return undefined;

        const fullKey = link.slice(this.PREFIX.length);
        const [keyPart, base64Name] = fullKey.split('#');

        if (!this.isValidPubKey(keyPart)) return undefined;

        const result: ContactData = { pubkey: keyPart };

        if (base64Name) {
            try {
                const s = fromUtf8(fromBase64(base64Name));
                result.name = s;
            } catch (e) {
                console.error("Failed to decode contact name:", e);
            }
        }

        return result;
    }

    private static isValidPubKey(key: string): boolean {
        const firstChar = key[0];
        if (firstChar !== '0' && firstChar !== '1') return false;

        const base64Part = key.slice(1);
        const base64Regex = /^[A-Za-z0-9+/]{42,43}={0,2}$/;

        return (
            base64Part.length >= 43 &&
            base64Part.length <= 44 &&
            base64Regex.test(base64Part)
        );
    }
}