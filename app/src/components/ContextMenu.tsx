import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import useATheme from '../theme.ts';
import React, {JSX} from 'react';
import { useTranslation } from '../translations/translations.ts';

export type Option = {
  title: string,
  action: ()=>void,
  danger?: boolean
}

export default function ContextMenu({ options, header, visible, onClose }: {options: Option[], header: JSX.Element|JSX.Element[], visible: boolean, onClose: ()=>void}) {
  const [tr] = useTranslation();

  const theme = useATheme();

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
                  backgroundColor:
                    theme.backgroundColor === '#000000' ? '#1c1c1e' : '#fff',
                },
              ]}
            >
              <View style={styles.header}>{header}</View>

              {options.map(x => (
                <>
                  <TouchableOpacity
                      key={x.title+"_option"}
                    style={styles.option}
                    onPress={x.action}
                  >
                    <Text style={{ color: x.danger?'#FF3B30':theme.color, fontSize: 17 }}>
                      {x.title}
                    </Text>
                  </TouchableOpacity>

                  <View
                      key={x.title+"_sep"}
                    style={[styles.sep, { backgroundColor: theme.dim + '20' }]}
                  />
                </>
              ))}

              <TouchableOpacity style={[styles.option,styles.cancelBtn]} onPress={onClose}>
                <Text
                  style={{
                    color: theme.color,
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  {tr('cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

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
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  header: { marginBottom: 20, width: "100%" },
  option: { paddingVertical: 16, alignItems: 'center', width: '100%' },
  sep: { height: 1, width: '90%', alignSelf: 'center' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
 });
