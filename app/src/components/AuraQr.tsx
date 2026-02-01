import React, { useMemo } from 'react';
import { useColorScheme, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import Aura from './Aura.tsx';
import { sha256 } from 'js-sha256';
import { ContactLink } from '../ContactLink.ts';

export default function AuraQr({ pubkey, name }) {
  const SIZE = 10;
  const R = SIZE * 0.5;
  const LOGO_SIZE = SIZE * 10;

  const LOGO_PADDING = 32;

  const scheme = useColorScheme();

  const { path, viewBox, logoPosition, gradient } = useMemo(() => {
    const qr = qrcode(0, 'H');
    qr.addData(ContactLink.serialize({ name: name, pubkey: pubkey }));
    qr.make();
    const count = qr.getModuleCount();
    const totalSize = count * SIZE;

    const centerIdx = Math.floor(count / 2);
    const logoModulesHalf = Math.ceil(LOGO_SIZE / SIZE / 2);

    const isLogoZone = (r, c) => {
      return (
        r >= centerIdx - logoModulesHalf &&
        r < centerIdx + logoModulesHalf &&
        c >= centerIdx - logoModulesHalf &&
        c < centerIdx + logoModulesHalf
      );
    };

    const isDark = (r, c) => {
      if (r < 0 || c < 0 || r >= count || c >= count) return false;
      if (isLogoZone(r, c)) return false;
      return qr.isDark(r, c);
    };

    let d: string[] = [];

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!isDark(r, c)) continue;

        const x = c * SIZE;
        const y = r * SIZE;

        const top = isDark(r - 1, c);
        const bottom = isDark(r + 1, c);
        const left = isDark(r, c - 1);
        const right = isDark(r, c + 1);

        d.push(`M ${x + SIZE / 2} ${y}`);

        if (top || right) {
          d.push(`L ${x + SIZE} ${y}`);
          d.push(`L ${x + SIZE} ${y + SIZE / 2}`);
        } else {
          d.push(`A ${R} ${R} 0 0 1 ${x + SIZE} ${y + SIZE / 2}`);
        }

        if (right || bottom) {
          d.push(`L ${x + SIZE} ${y + SIZE}`);
          d.push(`L ${x + SIZE / 2} ${y + SIZE}`);
        } else {
          d.push(`A ${R} ${R} 0 0 1 ${x + SIZE / 2} ${y + SIZE}`);
        }

        if (bottom || left) {
          d.push(`L ${x} ${y + SIZE}`);
          d.push(`L ${x} ${y + SIZE / 2}`);
        } else {
          d.push(`A ${R} ${R} 0 0 1 ${x} ${y + SIZE / 2}`);
        }

        if (left || top) {
          d.push(`L ${x} ${y}`);
          d.push(`L ${x + SIZE / 2} ${y}`);
        } else {
          d.push(`A ${R} ${R} 0 0 1 ${x + SIZE / 2} ${y}`);
        }

        d.push('Z');
      }
    }

    const hashHex = sha256(pubkey);
    const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;
    const grad_a = `hsla(${baseHue}, 95%, 60%, 1)`;
    const grad_b = `hsla(${(baseHue + 40) % 360}, 80%, 40%, 1)`;

    return {
      path: d.join(' '),
      viewBox: `0 0 ${totalSize} ${totalSize}`,
      logoPosition: totalSize / 2,
      gradient: {
        a: grad_a,
        b: grad_b,
      },
    };
  }, [pubkey, name]);

  return (
    <View
      style={{
        backgroundColor: 'transparent',
        width: '100%',
        height: '100%',
      }}
    >
      <Svg viewBox={viewBox}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradient.a} />
            <Stop offset="100%" stopColor={gradient.b} stopOpacity={0.7} />
          </LinearGradient>
        </Defs>

        <Path d={path} fill="url(#grad)" />

        <G
          transform={`translate(${
            logoPosition - LOGO_SIZE / 2 - R - LOGO_PADDING
          }, ${logoPosition - LOGO_SIZE / 2 - R - LOGO_PADDING})`}
        >
          <Aura
            size={LOGO_SIZE + LOGO_PADDING * 2}
            animate={true}
            publicKey={pubkey}
            theme={scheme}
          />
        </G>
      </Svg>
    </View>
  );
}
