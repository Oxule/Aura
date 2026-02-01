import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  useColorScheme,
  Vibration,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Nav, RootStackParamList } from '../../../App.tsx';
import useATheme, { style_dim } from '../../theme.ts';
import { useNavigation } from '@react-navigation/core';
import { useAtom } from 'jotai/react';
import useKeys from '../../useKeys.ts';
import Header from '../../components/Header.tsx';
import PowSubHeader from '../../components/PowSubHeader.tsx';
import { useContacts } from '../../storage/contacts.ts';
import { parsePubkey } from '../HomeScreen.tsx';
import { channelsAtom } from '../../storage/channels.ts';

import AuraComp from '../../components/Aura.tsx';
import { sha256 } from 'js-sha256';
import MessagesList from './MessagesList.tsx';
import Send from './Send.tsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import ContactModal from "../../components/ContactModal.tsx";

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route }: Props) {
  const theme = useATheme();

  const insets = useSafeAreaInsets();

  const [contacts, addContact] = useContacts();

  const contact = contacts[route.params.publicKey];

  const { publicKey, type } = parsePubkey(route.params.publicKey);

  const [channels] = useAtom(channelsAtom);

  var privateKey: string | undefined;
  if (type === 'broadcast') {
    privateKey = channels[publicKey] as string | undefined;
  }

  const canSend = type === 'direct' || (type === 'broadcast' && privateKey);

  const { pub } = useKeys();

  const [isOptionsVisible, setOptionsVisible] = useState(false);

  useEffect(() => {
    if (publicKey === pub) {
      nav.navigate('Home');
    }
  }, [pub, route]);

  const nav = useNavigation<Nav>();

  const colorScheme = useColorScheme();

  if (contact === undefined || contact.pubkey === undefined) {
    return <></>;
  }

  const getContrastColor = hue => {
    if (hue > 45 && hue < 190) {
      return '#000000';
    }
    return '#FFFFFF';
  };

  const hashHex = sha256(route.params.publicKey);
  const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;
  const hue = (baseHue + 25) % 360;
  const text = getContrastColor(hue);
  const accent = `hsla(${hue}, 64%, 58%, 1)`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <ContactModal
        visible={isOptionsVisible}
        onClose={() => setOptionsVisible(false)}
        pubkey={route.params.publicKey}
      />

      <Header>
        <TouchableOpacity
          onPress={() => setOptionsVisible(true)}
          hitSlop={{ top: 32, bottom: 32, left: 32, right: 32 }}
        >
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AuraComp
              theme={colorScheme}
              size={64}
              publicKey={route.params.publicKey}
            />
            <View>
              <Text
                style={{ color: theme.color, fontSize: 18, fontWeight: 'bold' }}
              >
                {contact.name}
              </Text>
              ,
              <Text style={[style_dim(theme), { fontSize: 10, marginTop: 4 }]}>
                {publicKey.slice(0, 8)}...{publicKey.slice(-4)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Header>
      {canSend && (
        <PowSubHeader
          profile={type}
          bits={contact?.pow}
          setBits={(b: number) => {
            Vibration.vibrate(10);
            addContact({ ...contact, pow: b });
          }}
          theme={theme}
        />
      )}
      <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          bottomOffset={insets.bottom}
      >
        <View style={{ flex: 1 }}>
          <MessagesList
              pubkey={route.params.publicKey}
              color={text}
              accent={accent}
          />
        </View>
      </KeyboardAwareScrollView>

      {canSend && (
          <KeyboardStickyView offset={{ closed: insets.bottom, opened: 0 }}>
            <View style={{ backgroundColor: theme.backgroundColor }}>
              <Send
                  accent={accent}
                  pubkey={route.params.publicKey}
                  color={text}
                  bits={contact.pow}
              />
            </View>
          </KeyboardStickyView>
      )}
    </SafeAreaView>
  );
}
