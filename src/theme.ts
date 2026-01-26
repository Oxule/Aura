import {useColorScheme} from "react-native";
import useKeys from "./useKeys.ts";
import {sha256} from "js-sha256";
import {PRNG} from "./components/Aura.tsx";

type Theme = {
    backgroundColor: string,
    color: string,
    dim: string,
    accent: string,
    hard: string
}

const Themes : {[key:string]: Theme} = {
    light: {
        backgroundColor: '#FFFFFF',
        color: '#000000',
        dim: '#474747',
        accent: '#359536',
        hard: '#FF9500'
    },
    dark: {
        backgroundColor: '#000000',
        color: '#FFFFFF',
        dim: '#9e9e9e',
        accent: '#359536',
        hard: '#FF9500'
    },
};

export const Sizings : {[key: string]: number} = {
    h1: 48,
    h2: 32,
    h3: 24,
    regular: 16,
    dim: 12
}

export const Spacings : {[key:string]: number} = {
    minor: 12,
    major: 24,
    block: 32
}

export function style_h1(theme: Theme) {
    return {color: theme.color, fontSize: Sizings.h1};
}
export function style_h2(theme: Theme) {
    return {color: theme.color, fontSize: Sizings.h2};
}
export function style_h3(theme: Theme) {
    return {color: theme.color, fontSize: Sizings.h3};
}
export function style_regular(theme: Theme) {
    return {color: theme.color, fontSize: Sizings.regular};
}
export function style_dim(theme: Theme) {
    return {color: theme.dim, fontSize: Sizings.dim};
}
export function style_textfield(theme: Theme) {
    return {color: theme.color, fontSize: Sizings.h3, borderColor: theme.color, borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12};
}

export default function useATheme(){
    const {pub} = useKeys()

    const scheme = useColorScheme();
    const theme = scheme === 'dark' ? Themes.dark : Themes.light

    if(pub) {

        const hashHex = sha256("0" + pub);
        const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;
        const hue = (baseHue + 25) % 360
        const accent = `hsla(${hue}, 60%, 55%, 1)`

        const th = {...theme, accent, baseAccent: theme.accent}

        return th;
    }
    return {...theme, baseAccent: theme.accent}
}

