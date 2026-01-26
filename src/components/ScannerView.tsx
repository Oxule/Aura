import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import { Camera, Code, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";

const { width } = Dimensions.get('window');
const innerSize = width * 0.6;

export const ScannerView = ({ onScan, theme, tr }: any) => {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice("back");

    useEffect(() => {
        requestPermission();
    }, []);

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes: Code[]) => {
            const value = codes[0]?.value;
            if (value) onScan(value);
        },
    });

    if (!hasPermission || !device) {
        return <View style={[styles.scannerPlaceholder, { backgroundColor: theme.dim + '10' }]} />;
    }

    return (
        <View style={styles.scannerWrapper}>
            <Camera
                style={StyleSheet.absoluteFill}
                codeScanner={codeScanner}
                device={device}
                isActive={true}
            />
            <View style={styles.overlay}>
                <View style={[styles.corner, styles.tl, { borderColor: theme.accent }]} />
                <View style={[styles.corner, styles.tr, { borderColor: theme.accent }]} />
                <View style={[styles.corner, styles.bl, { borderColor: theme.accent }]} />
                <View style={[styles.corner, styles.br, { borderColor: theme.accent }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    scannerWrapper: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginVertical: 20,
    },
    scannerPlaceholder: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 24,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60
    },
    corner: { position: 'absolute', width: 20, height: 20, borderWidth: 3 },
    tl: { top: 40, left: 40, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
    tr: { top: 40, right: 40, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
    bl: { bottom: 40, left: 40, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
    br: { bottom: 40, right: 40, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
});