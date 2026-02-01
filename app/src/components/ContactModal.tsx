import React, { useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Vibration,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';

import AuraQr from './AuraQr.tsx';
import useATheme from '../theme.ts';
import { contactsAtom, useContacts } from '../storage/contacts.ts';
import { ContactLink } from '../ContactLink.ts';
import { sha256 } from 'js-sha256';
import {Ban, Edit, Pin, VolumeOff} from 'lucide-react-native';
import RenameModal from './RenameModal.tsx';
import {TranslateFunction, useTranslation} from '../translations/translations.ts';
import useKeys from '../useKeys.ts';
import { useAtom } from 'jotai';
import {messagesAtom} from "../storage/messages.ts";
import {channelsAtom} from "../storage/channels.ts";
import {useNavigation} from "@react-navigation/core";
import {Nav} from "../../App.tsx";

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

export default function ContactModal({ pubkey, visible, onClose }) {
  const theme = useATheme();
  const [contacts, addContact] = useContacts();
  const [tr] = useTranslation();

  const nav = useNavigation<Nav>();

  const [renameVisible, setRenameVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewShotRef = useRef(undefined);

  const { pub: userPubkey, regenerate } = useKeys();

  const [, contacts_dispatch] = useAtom(contactsAtom);
  const [, setChannels] = useAtom(channelsAtom);
  const [, messages_dispatch] = useAtom(messagesAtom);

  const handleResetAccount = () => {
    confirmAlert(tr, () => {
      regenerate();
      messages_dispatch({ type: "wipe" });
      contacts_dispatch({ action: "clear" });
      setChannels({});
      onClose();
      nav.navigate("Home")
    });
  };

  const handleDeleteContact = () => {
    confirmAlert(tr, () => {
      messages_dispatch({ type: "delete", payload: {all: true, contact: pubkey}});
      contacts_dispatch({ action: "delete", payload: pubkey });
      setChannels(x=>{
        var n = x;
        delete n[pubkey]
        return n
      });
      onClose();
      nav.navigate("Home")
    });
  };
  
  if (pubkey === undefined) return null;

  const personal = userPubkey && '0' + userPubkey === pubkey;

  const contact = contacts[pubkey];
  if (!contact && !personal) return null;

  const link = ContactLink.serialize({
    pubkey,
    name: undefined /*contact?.name*/,
  });

  const handleUpdateName = newName => {
    addContact({ ...contact, name: newName });
    setRenameVisible(false);
  };

  const handleCopy = () => {
    Clipboard.setString(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLongPress = async () => {
    try {
      Vibration.vibrate(50);
      //@ts-ignore
      const uri = await viewShotRef.current.capture();
      await Share.open({
        message: `Connect with ${contact.name}: ${link}`,
        url: uri,
        type: 'image/png',
        failOnCancel: false,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const hashHex = sha256(pubkey);
  const baseHue = parseInt(hashHex.substring(0, 8), 16) % 360;
  const accent = `hsla(${(baseHue + 20) % 360}, 95%, 60%, 1)`;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: theme.backgroundColor,
                  borderWidth: 1,
                  borderColor: theme.dim + '30',
                },
              ]}
            >
              {personal ? (
                <Text
                  style={{
                    color: theme.dim,
                    textAlign: 'center',
                    fontSize: 18,
                    marginBottom: 24,
                    fontWeight: 'semibold',
                  }}
                >
                  {tr('home_pub_key')}
                </Text>
              ) : (
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: 24,
                    position: 'relative',
                  }}
                >
                  <Text
                    style={[
                      styles.name,
                      { color: theme.color, textAlign: 'center' },
                    ]}
                  >
                    {contact.name}
                  </Text>

                  <TouchableOpacity
                    onPress={() => setRenameVisible(true)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                    }}
                  >
                    {/*@ts-ignore*/}
                    <Edit style={{ color: accent }} width={32} height={32} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={handleLongPress}
                delayLongPress={300}
                style={styles.qrContainer}
              >
                {/*@ts-ignore*/}
                <ViewShot style={{ width: '100%', height: '100%' }} ref={viewShotRef}
                  options={{ format: 'png', quality: 1.0 }}
                >
                  <AuraQr pubkey={pubkey} name={contact?.name} />
                </ViewShot>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopy}
                activeOpacity={0.7}
                style={[styles.pill, { backgroundColor: theme.dim + '15' }]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: copied ? accent : theme.color },
                  ]}
                >
                  {copied
                    ? 'Copied!'
                    : link.slice(0, 16) + '...' + link.slice(-8)}
                </Text>
              </TouchableOpacity>

              {
                !personal &&
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    marginTop: 16,
                    gap: 16
                  }}
                >
                  <OptionToggle
                      Icon={VolumeOff}
                      onToggle={() => addContact({ ...contact, is_muted: !contact.is_muted })}
                      value={contact.is_muted}
                      accent={accent}
                      background={theme.backgroundColor}
                  />
                  <OptionToggle
                      Icon={Pin}
                      onToggle={() => addContact({ ...contact, is_pinned: !contact.is_pinned })}
                      value={contact.is_pinned}
                      accent={accent}
                      background={theme.backgroundColor}
                  />
                  <OptionToggle
                      Icon={Ban}
                      onToggle={() => addContact({ ...contact, is_blocked: !contact.is_blocked })}
                      value={contact.is_blocked}
                      accent={accent}
                      background={theme.backgroundColor}
                  />
                </View>
              }

              <View style={{display: "flex", flexDirection: "column", gap: 8, marginTop: 64, width: "100%", alignItems: "center"}}>
                <TouchableOpacity style={{backgroundColor: "#da2323", padding: 12, borderRadius: 18, width: "80%"}} onPress={()=>{
                  if(personal) {
                    handleResetAccount()
                  }
                  else {
                    handleDeleteContact()
                  }
                }}>
                  <Text style={{fontSize: 18, fontWeight: "bold", textAlign: "center"}}>{personal?tr("accopts_reset"):tr("contact_delete")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      <RenameModal
        visible={renameVisible}
        initialName={contact?.name}
        accent={accent}
        onClose={() => setRenameVisible(false)}
        onSave={handleUpdateName}
      />
    </Modal>
  );
}

function OptionToggle({Icon, onToggle, value, accent, background}) {
  return <TouchableOpacity onPress={()=>onToggle()} hitSlop={16}>
    <View style={[styles.toggleButton, value ? {backgroundColor: accent} : {borderWidth: 1, borderColor: accent}]}>
      <Icon style={{color: value?background:accent}} size={"100%"}/>
    </View>
  </TouchableOpacity>
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  qrContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 100,
    minWidth: 120,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleButton: {
    padding: 12,
    width: 48,
    height: 48,
    borderRadius: 18
  }
});
