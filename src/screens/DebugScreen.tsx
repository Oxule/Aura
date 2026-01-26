import Svg, {Defs, G, LinearGradient, Path, Stop} from 'react-native-svg';
import randomIcons, {parseSvgContent} from "../components/randomIcons.tsx";
import {ScrollView, useColorScheme, View} from "react-native";
import Aura from "../components/Aura.tsx";
import React from "react";
import {DEEPLINK_PREFIX} from "../deeplink.ts";
import SmartDataShare from "../components/SmartDataShare.tsx";

export default function DebugScreen() {
    const colorScheme = useColorScheme()

    return <>
        {/*<Aura animate={true} theme={colorScheme} publicKey={"test"}/>
        <Aura animate={false} theme={colorScheme} publicKey={"testa"}/>*/}
        <ScrollView
            contentContainerStyle={{
                flexDirection: 'column',
                flexWrap: 'wrap',
                justifyContent: 'center',
            }}
        >
            {Array.from({length: 5}).map((_,i)=><Aura size={256/(Math.pow(2,i))} animate={false} theme={colorScheme} publicKey={"ggg"}/>)}
        </ScrollView>
        <ScrollView
            contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                paddingVertical: 20
            }}
        >
            {randomIcons.map((rawSvg, i) => {
                const paths = parseSvgContent(rawSvg);
                return (
                    <View key={i} style={{ padding: 10, backgroundColor: '#111' }}>
                        <Svg
                            width={64}
                            height={64}
                            viewBox="0 0 24 24"
                        >
                            <Defs>
                                <LinearGradient id={`g-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#8A2BE2" />
                                    <Stop offset="100%" stopColor="#00D1FF" />
                                </LinearGradient>
                            </Defs>

                            <G>
                                {paths.map((d, index) => (
                                    <Path
                                        key={index}
                                        d={d}
                                        stroke={`url(#g-${i})`}
                                        fill="none"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                    />
                                ))}
                            </G>
                        </Svg>
                    </View>
                );
            })}
        </ScrollView>
    </>
}