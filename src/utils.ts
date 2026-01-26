const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export const toBase64 = (bytes: Uint8Array): string => {
    let output = '';
    let i = 0;

    while (i < bytes.length) {
        const byte1 = bytes[i++];
        const byte2 = bytes[i++];
        const byte3 = bytes[i++];

        const enc1 = byte1 >> 2;
        const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
        let enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
        let enc4 = byte3 & 63;

        if (isNaN(byte2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(byte3)) {
            enc4 = 64;
        }

        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
    return output;
};

export const fromBase64 = (str: string): Uint8Array => {
    let output: number[] = [];
    let i = 0;
    const input = str.replace(/[^A-Za-z0-9+/=]/g, '');

    while (i < input.length) {
        const enc1 = chars.indexOf(input.charAt(i++));
        const enc2 = chars.indexOf(input.charAt(i++));
        const enc3 = chars.indexOf(input.charAt(i++));
        const enc4 = chars.indexOf(input.charAt(i++));

        const byte1 = (enc1 << 2) | (enc2 >> 4);
        const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const byte3 = ((enc3 & 3) << 6) | enc4;

        output.push(byte1);
        if (enc3 !== 64) output.push(byte2);
        if (enc4 !== 64) output.push(byte3);
    }

    return new Uint8Array(output);
};


export const toUtf8 = (str: string): Uint8Array => {
    const result: number[] = [];
    for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) result.push(charcode);
        else if (charcode < 0x800) {
            result.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
            result.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
            i++;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            result.push(
                0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f)
            );
        }
    }
    return new Uint8Array(result);
};

export const fromUtf8 = (bytes: Uint8Array): string => {
    let result = '';
    let i = 0;
    while (i < bytes.length) {
        const b = bytes[i++];
        if (b < 0x80) result += String.fromCharCode(b);
        else if (b < 0xe0) result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
        else if (b < 0xf0) result += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
        else {
            const code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
            result += String.fromCharCode(0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff));
        }
    }
    return result;
};