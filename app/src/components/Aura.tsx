import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import Svg, {
    Circle, G, Defs, LinearGradient, Stop, RadialGradient, Path, Rect, Line,
} from 'react-native-svg';
import { sha256 } from "js-sha256";
import randomIcons, { parseSvgContent } from "./randomIcons.tsx";

const AnimatedG = Animated.createAnimatedComponent(G);

export class PRNG {
    private seed: number;
    constructor(publicId: string) { this.seed = this.hashString(publicId); }
    private hashString(str: string): number {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
    public next(): number {
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    public range(min: number, max: number): number { return min + this.next() * (max - min); }
}

const createBlobPath = (points: {x: number, y: number}[]) => {
    if (points.length < 3) return "";
    const getPt = (i: number) => points[(i + points.length) % points.length];
    const startMidX = (getPt(0).x + getPt(-1).x) / 2;
    const startMidY = (getPt(0).y + getPt(-1).y) / 2;
    let path = `M${startMidX},${startMidY} `;
    for (let i = 0; i < points.length; i++) {
        const pCurrent = getPt(i);
        const pNext = getPt(i + 1);
        const midX = (pCurrent.x + pNext.x) / 2;
        const midY = (pCurrent.y + pNext.y) / 2;
        path += `Q${pCurrent.x},${pCurrent.y} ${midX},${midY} `;
    }
    return path + "Z";
};

const Aura = ({ publicKey, size = 300, theme = 'dark', animate = true }) => {
    const isDark = theme === 'dark';
    const anim = useRef(new Animated.Value(0)).current;

    animate = false

    useEffect(() => {
        if (animate) {
            anim.setValue(0);
            Animated.loop(
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 10000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        }
    }, [animate, publicKey]);

    const config = useMemo(() => {
        const hashHex = sha256(publicKey);
        const rng = new PRNG(hashHex);
        const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;

        const ringsCount = rng.range(8,14)

        return {
            colors: {
                a: `hsla(${baseHue}, ${isDark ? 85 : 95}%, ${isDark ? 70 : 45}%, 1)`,
                b: `hsla(${(baseHue + 40) % 360}, ${isDark ? 75 : 85}%, ${isDark ? 55 : 35}%, 1)`,
                haloOpacity: isDark ? 0.3 : 0.15,
            },
            blobs: Array.from({ length: 3 }).map((_, i) => ({
                path: createBlobPath(Array.from({ length: 6 }).map((__, j) => {
                    const rad = rng.range(size * 0.2, size * 0.4);
                    return {
                        x: Math.cos(j * Math.PI * 2 / 6) * rad,
                        y: Math.sin(j * Math.PI * 2 / 6) * rad,
                    };
                })),
                speed: rng.range(0.8, 1.2) * (i % 2 === 0 ? 1 : -1),
                scaleD: rng.range(1.05, 1.15)
            })),
            rings: Array.from({ length: ringsCount }).map((_, i) => ({
                radius: size / 4,
                x: Math.cos(i * Math.PI * 2 / ringsCount) * size/5,
                y: Math.sin(i * Math.PI * 2 / ringsCount) * size/5,
                speed: (0.5 + (i % 3) * 0.4) * (i % 2 === 0 ? 1 : -1),
                opacity: rng.range(0.15, 0.5)
            })),
            icon: parseSvgContent(randomIcons[Math.floor(rng.range(0, randomIcons.length))]),
            iconScale: (size / 24) * 0.45
        };
    }, [publicKey, size, isDark]);

    const rotation = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const pulse = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.1, 1],
    });

    const tilt = anim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ['0deg', '2deg', '0deg', '-2deg', '0deg'],
    });

    const center = size / 2;

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox={`0 0} ${size} ${size}`}>
                <Defs>
                    <RadialGradient id="halo">
                        <Stop offset="0%" stopColor={config.colors.a} stopOpacity={config.colors.haloOpacity} />
                        <Stop offset="100%" stopColor={config.colors.b} stopOpacity="0" />
                    </RadialGradient>
                    <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={config.colors.a} />
                        <Stop offset="100%" stopColor={config.colors.b} stopOpacity={0.7} />
                    </LinearGradient>
                </Defs>

                <G x={center} y={center}>
                    <Circle r={size * 0.45} fill="url(#halo)" />
                </G>

                <G x={center} y={center}>
                    {config.blobs.map((blob, i) => (
                        /*@ts-ignore*/
                        <AnimatedG key={i} style={{
                            transform: [
                                { rotate: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', `${360 * blob.speed}deg`]
                                    })},
                                { scale: pulse }
                            ]
                        }}>
                            <Path d={blob.path} fill="url(#grad)" opacity={0.08} />
                        </AnimatedG>
                    ))}
                </G>

                <G x={center} y={center}>
                    {config.rings.map((ring, i) => (
                        /*@ts-ignore*/
                        <AnimatedG key={i} style={{
                            transform: [
                                { rotate: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', `${360 * ring.speed}deg`]
                                    })},
                                { scale: pulse }
                            ]
                        }}>
                            <Circle
                                cx={ring.x} cy={ring.y} r={ring.radius}
                                fill="none" stroke="url(#grad)"
                                strokeWidth={1.2*size/100} strokeOpacity={ring.opacity}
                            />
                        </AnimatedG>
                    ))}
                </G>

                {/*@ts-ignore*/}
                <AnimatedG style={{
                    transform: [
                        { translateX: center },
                        { translateY: center },
                        { scale: pulse },
                        { rotate: tilt }
                    ]
                }}>
                    <G transform={`scale(${config.iconScale}) translate(-12, -12)`}>
                        {config.icon.map((el, i) => (
                            <Path key={i} d={el} stroke="url(#grad)" fill="none" strokeWidth={2} strokeLinecap="round" />
                        ))}
                    </G>
                </AnimatedG>
            </Svg>
        </View>
    );
};

export default Aura;