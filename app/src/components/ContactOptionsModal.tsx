import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useAtom } from 'jotai';
import useATheme, { style_dim } from '../theme.ts';
import { useNavigation } from '@react-navigation/core';
import { Nav } from '../../App.tsx';
import {
  TranslateFunction,
  useTranslation,
} from '../translations/translations.ts';
import { contactsAtom, useContacts } from '../storage/contacts.ts';
import { messagesAtom } from '../storage/messages.ts';
import { parsePubkey } from '../screens/HomeScreen.tsx';
import { channelsAtom } from '../storage/channels.ts';
import ContextMenu from './ContextMenu.tsx';
import Aura from './Aura.tsx';
import { DEEPLINK_PREFIX } from '../deeplink.ts';
import SmartDataShare from './SmartDataShare.tsx';

interface ContactOptionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  publicKey: string;
  showMarkRead?: boolean;
}

export function confirmAlert(tr: TranslateFunction, onConfirm: () => void) {
  Alert.alert(tr('alert_confirm_title'), tr('alert_confirm_text'), [
    { text: tr('no'), style: 'cancel' },
    {
      text: tr('yes'),
      style: 'destructive',
      onPress: onConfirm,
    },
  ]);
}

export default function ContactOptionsModal({
  isVisible,
  onClose,
  publicKey,
  showMarkRead = false,
}: ContactOptionsModalProps) {
  const [tr] = useTranslation();

  const theme = useATheme();
  const nav = useNavigation<Nav>();

  const [contacts, addContact] = useContacts();
  const contact = contacts[publicKey];

  const [_a, contacts_dispatch] = useAtom(contactsAtom);

  const [_b, messages_dispatch] = useAtom(messagesAtom);

  const [channels, setChannels] = useAtom(channelsAtom);

  const [isRenameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const displayName = contact?.name || tr('unknown');

  const colorScheme = useColorScheme();

  const [isShareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    if (isRenameVisible)
      setNewName(displayName === tr('unknown') ? '' : displayName);
  }, [isRenameVisible, displayName]);

  if (contact === undefined) {
    return <></>;
  }

  const pubkey_parsed = parsePubkey(contact.pubkey);

  const handleMarkRead = () => {
    messages_dispatch({
      type: 'readall',
      payload: { contact: contact.pubkey },
    });
    onClose();
  };

  const handleClearChat = () => {
    Alert.alert(tr('alert_clear_chat_title'), tr('alert_clear_chat_message'), [
      { text: tr('cancel'), style: 'cancel' },
      {
        text: tr('contact_clear_history'),
        style: 'destructive',
        onPress: () => {
          messages_dispatch({
            type: 'delete',
            payload: { all: true, contact: contact.pubkey },
          });
          onClose();
        },
      },
    ]);
  };

  const handleDeleteContact = () => {
    confirmAlert(tr, () => {
      contacts_dispatch({
        action: 'delete',
        payload: { contact: contact.pubkey },
      });
      messages_dispatch({
        type: 'delete',
        payload: { all: true, contact: contact.pubkey },
      });
      if (pubkey_parsed.type === 'broadcast') {
        setChannels(x => {
          const n = x;
          delete x[pubkey_parsed.publicKey];
          return n;
        });
      }
      nav.navigate('Home');
      onClose();
    });
  };

  const handleBlockContact = () => {
    confirmAlert(tr, () => {
      addContact({ ...contact, is_blocked: true });
      nav.navigate('Home');
      onClose();
    });
  };
  const handleUnblockContact = () => {
    addContact({ ...contact, is_blocked: false });
    onClose();
  };

  const saveRename = () => {
    const trimmed = newName.trim();
    addContact({ ...contact, name: trimmed || tr('unknown') });
    setRenameVisible(false);
    onClose();
  };

  return [
    <ContextMenu
      visible={isVisible}
      onClose={onClose}
      header={
        <View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              width: "100%"
            }}
          >
            <Aura theme={colorScheme} size={72} publicKey={contact.pubkey} />
            <View>
              <Text
                style={{ color: theme.color, fontSize: 18, fontWeight: 'bold' }}
              >
                {displayName}
              </Text>
              ,
              <Text style={[style_dim(theme), { fontSize: 10, marginTop: 4 }]}>
                {publicKey.slice(1, 9)}...{publicKey.slice(-4)}
              </Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 12 }}>
            <SmartDataShare data={DEEPLINK_PREFIX + publicKey} />
          </View>
        </View>
      }
      options={[
        ...(showMarkRead
          ? [
              {
                title: tr('contact_mark_as_read'),
                action: handleMarkRead,
              },
            ]
          : []),

        {
          title: tr('rename'),
          action: () => setRenameVisible(true),
        },
        /*{
                  title: tr('share'),
                  action: () => {
                    setShareVisible(true)
                    //nav.navigate('ContactShare', { pubkey: publicKey });
                    //onClose();
                  },
                },*/
        /*{
                  title: tr('contact_clear_history'),
                  action: handleClearChat,
                  danger: true,
                },*/
        /*{
                  title: tr('contact_delete'),
                  action: handleDeleteContact,
                  danger: true,
                },*/
        {
          title: contact.is_blocked
            ? tr('contact_unblock')
            : tr('contact_block'),
          action: contact.is_blocked
            ? handleUnblockContact
            : handleBlockContact,
          danger: true,
        },
      ]}
    />,
    <InputModal
      visible={isRenameVisible}
      onClose={() => setRenameVisible(false)}
      title={tr('rename')}
      value={newName}
      onChangeText={setNewName}
      placeholder={tr('placeholder_enter_name')}
      maxLength={25}
      onSubmit={saveRename}
      submitText={tr('save')}
      cancelText={tr('cancel')}
    />,
  ];
}

export const InputModal = ({
  visible,
  onClose,
  title,
  value,
  onChangeText,
  onSubmit,
  submitText,
  cancelText,
  ...props
}) => {
  const theme = useATheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={onClose}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  theme.backgroundColor === '#000000' ? '#1c1c1e' : '#fff',
              },
            ]}
          >
            <Text style={[style_dim(theme), { marginBottom: 20 }]}>
              {title}
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: theme.color,
                  backgroundColor: theme.dim + '10',
                  borderColor: theme.dim + '30',
                },
              ]}
              value={value}
              onChangeText={onChangeText}
              autoFocus
              {...props}
            />

            <View style={styles.row}>
              <TouchableOpacity style={styles.flexBtn} onPress={onClose}>
                <Text style={{ color: theme.color, fontSize: 17 }}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.flexBtn} onPress={onSubmit}>
                <Text
                  style={{
                    color: theme.color,
                    fontSize: 17,
                    fontWeight: 'bold',
                  }}
                >
                  {submitText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
  },
  header: { alignItems: 'center', marginBottom: 20 },
  option: { paddingVertical: 16, alignItems: 'center', width: '100%' },
  sep: { height: 1, width: '90%', alignSelf: 'center' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  input: {
    width: '100%',
    minWidth: '90%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 18,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
  flexBtn: { padding: 10, minWidth: 100, alignItems: 'center' },
});
