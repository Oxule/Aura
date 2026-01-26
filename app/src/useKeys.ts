import {useEffect, useState} from "react";

import { NativeModules } from 'react-native';
import {useAtom} from "jotai/react";
import {atom} from "jotai";
const { Aura } = NativeModules;


export const publicKeyAtom = atom<string|undefined>(undefined);


export default function useKeys():{pub:string | undefined; regenerate: () => void}{
    const [pub, setPublic] = useAtom<string | undefined>(publicKeyAtom);

    function regenerate() {
        Aura.generateKeypair().then((x:{publicKey: string})=>setPublic(x.publicKey))
    }

    useEffect(() => {
        Aura.getKeypair().then((x:{publicKey: string})=>setPublic(x.publicKey))
    }, []);

    return {pub, regenerate}
}