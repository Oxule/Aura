import React, { useState } from 'react';
import { Clipboard, Platform, Share, StyleSheet, Text, View, Pressable } from 'react-native';
import useATheme, { Spacings, style_dim, Sizings } from '../theme.ts';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from '../translations/translations.ts';

export default function SmartDataShare({ data }: { data: string }) {
  const theme = useATheme();
  const [tr] = useTranslation();
  const [copied, setCopied] = useState(false);

  const QR_SIZE = 220;

  const handleCopy = () => {
    Clipboard.setString(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    Share.share({ message: data });
  };

  return (
      <View style={styles.container}>
        <View style={styles.whiteCard}>

          <View style={styles.qrSection}>
            <QRCode
                value={data}
                size={QR_SIZE}
                color="#000"
                backgroundColor="#FFF"
            />
          </View>

          <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.copyArea,
                pressed && { opacity: 0.3 }
              ]}
              hitSlop={32}
          >
            <Text style={[styles.monoKey]} numberOfLines={1}>
              {copied ? `✓ ${tr("copied") || "Copied"}` : data}
            </Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareArea,
                pressed && { backgroundColor: '#f9f9f9' }
              ]}
          >
            <Text style={[styles.shareText]}>
              {tr("share").toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: Spacings.major,
  },
  whiteCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: '100%',
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  qrSection: {
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyArea: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  monoKey: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  shareArea: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});