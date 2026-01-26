import {atomWithAsyncStorage} from "../atomWithAsyncStorage.ts";
import en from "./en.ts";
import {useAtom} from "jotai/react";
import ru from './ru.ts';
import zh from './zh.ts';
import hi from "./hi.ts";
import ar from "./ar.ts";

export type TranslationKey = keyof typeof en | string;

export type Translation = Record<TranslationKey, string>;

const translations: Record<string, Translation> = {
    en,
    ru,
    zh,
    hi,
    ar
} as const

export type Language = keyof typeof translations

export function getAllLanguages(): Record<string, {title: string, fulfilled: number, original: number}> {
    return Object.fromEntries(Object.entries(translations).map(([key,value])=>{
        const original = Object.entries(en).map(([k,v])=>k)
        var fulfilled = 0
        for (const k of original) {
            if(Object.entries(value).find(x=>x[0] === k)){
                fulfilled += 1
            }
        }
        return [key, {title: value.lang, fulfilled: fulfilled, original: original.length}]
    }))
}

const language = atomWithAsyncStorage<Language>("language", "en");

export type TranslateFunction = (key: TranslationKey) => string


export function useTranslation(): [TranslateFunction, Language, (lang: Language)=>{}]{
    const [lang, setLang] = useAtom(language);

    return [
        (key: TranslationKey) => {
            if(!Object.entries(en).find(x=>x[0] === key)){
                console.warn(`No translation key: "${key}"`)
                return key
            }
            return translations[lang][key] || en[key];
        },
        lang,
        setLang
    ]
}