import React, { useState } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    LayoutAnimation,
    Platform,
    UIManager, Button
} from 'react-native';
import {getAllLanguages, useTranslation} from "../translations/translations.ts";
import { useNavigation } from "@react-navigation/core";
import { Nav } from "../../App.tsx";
import useATheme, { Spacings, style_h3, style_dim } from '../theme.ts';
import Header from "../components/Header.tsx";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
    const [tr, lang, setLang] = useTranslation();
    const nav = useNavigation<Nav>();
    const theme = useATheme();

    const [expanded, setExpanded] = useState(false);

    const toggleDropdown = () => {
        LayoutAnimation.configureNext({
            duration: 250,
            update: { type: 'spring', springDamping: 0.8 },
        });
        setExpanded(!expanded);
    };

    const selectLanguage = (l: typeof lang) => {
        setLang(l);
        toggleDropdown();
    };

    const langs = getAllLanguages()

    const languages = Object.entries(langs).map(([k,v])=>({key: k, label: v}));

    const currentLabel = languages.find(l => l.key === lang)?.label;

    const cardBackground = theme.backgroundColor === '#000000'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.05)';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
            <Header>
                <Text style={[style_h3(theme), { fontSize: 18, fontWeight: '700' }]}>
                    {tr("settings_title")}
                </Text>
            </Header>

            <View style={styles.container}>
                <Text style={[style_dim(theme), styles.sectionLabel]}>
                    {tr("language")}
                </Text>

                <View style={[
                    styles.dropdownCard,
                    { backgroundColor: cardBackground }
                ]}>
                    <TouchableOpacity
                        style={styles.dropdownHeader}
                        onPress={toggleDropdown}
                        activeOpacity={0.6}
                    >
                        <Text style={{ color: theme.color, fontSize: 17, fontWeight: '500' }}>{currentLabel && (
                            `${currentLabel.title} (${Math.round((currentLabel.fulfilled / currentLabel.original) * 100)}%)`
                        )}</Text>
                        <Text style={{
                            color: theme.dim,
                            fontSize: 14,
                            fontWeight: 'bold',
                            transform: [{ rotate: expanded ? '180deg' : '0deg' }]
                        }}>
                            ▾
                        </Text>
                    </TouchableOpacity>

                    {expanded && (
                        <View style={styles.optionsContainer}>
                            <View style={[styles.divider, { backgroundColor: theme.dim + '15' }]} />
                            {languages.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={styles.optionRow}
                                    onPress={() => selectLanguage(item.key)}
                                >
                                    <Text style={{
                                        color: lang === item.key ? theme.accent : theme.color,
                                        fontSize: 16,
                                        fontWeight: lang === item.key ? '600' : '400',
                                        opacity: lang === item.key ? 1 : 0.8
                                    }}>
                                        {item.label && (
                                            `${item.label.title} (${Math.round((item.label.fulfilled / item.label.original) * 100)}%)`
                                        )}
                                    </Text>
                                    {lang === item.key && (
                                        <Text style={{ color: theme.accent, fontSize: 18, fontWeight: 'bold' }}>ʟ</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>

            {/*<Button title={"Debug"} onPress={()=>nav.navigate("Debug")}/>*/}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: Spacings.major,
        paddingVertical: Spacings.minor,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: { alignItems: 'center' },
    backArrow: {
        fontSize: 48,
        height: 32,
        width: 48,
        fontWeight: 'bold',
        textAlign: 'center',
        includeFontPadding: false,
        lineHeight: 18,
    },
    container: {
        padding: Spacings.major,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    dropdownCard: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    optionsContainer: {
        paddingBottom: 10,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    divider: {
        height: 1,
        marginHorizontal: 20,
    }
});