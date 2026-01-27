import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  DeviceEventEmitter,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import { createStaticNavigation } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { useEffect } from 'react';
import useATheme from './src/theme.ts';
import AddScreen from './src/screens/AddScreen.tsx';
import ChatScreen from './src/screens/ChatScreen/ChatScreen.tsx';
import { useAtom } from 'jotai/react';
import SettingsScreen from './src/screens/SettingsScreen.tsx';
import { useTranslation } from './src/translations/translations.ts';
import {
  contactsAtom,
  defaultContact,
  useContacts,
} from './src/storage/contacts.ts';
import {
  mapNativeMessage,
  messagesAtom,
  useMessages,
} from './src/storage/messages.ts';
import RequiresPermissions from './src/components/RequiresPermissions.tsx';
import { permissions } from './src/permissions.ts';
import DebugScreen from './src/screens/DebugScreen.tsx';
import {KeyboardProvider} from "react-native-keyboard-controller";

enableScreens();

export type RootStackParamList = {
  Home: undefined;
  Add: undefined;
  Chat: { publicKey: string };
  Settings: undefined;
  Debug: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;

function PageWrapper({ children }) {
  const theme = useATheme();
  return (
    <View
      style={{
        ...StyleSheet.absoluteFill,
        backgroundColor: theme.backgroundColor,
      }}
    >
      {children}
    </View>
  );
}

export const RootStack = createNativeStackNavigator<RootStackParamList>({
  initialRouteName: 'Home',
  screenOptions: {
    headerShown: false,
  },
  screenLayout: ({ children }) => <PageWrapper>{children}</PageWrapper>,
  screens: {
    Home: HomeScreen,
    Add: AddScreen,
    Chat: ChatScreen,
    Settings: SettingsScreen,
    Debug: DebugScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

function App() {
  const [_a, contacts_dispatch] = useAtom(contactsAtom);
  const [_b, messages_dispatch] = useAtom(messagesAtom);

  const [contacts, addContact] = useContacts();
  const [messages] = useMessages();
  useEffect(() => {
    console.log('Messages changed: ', messages);
  }, [messages]);
  useEffect(() => {
    console.log('Contacts changed: ', contacts);
  }, [contacts]);

  const scheme = useColorScheme();
  const [tr] = useTranslation();

  useEffect(() => {
    contacts_dispatch({ action: 'init' });
    messages_dispatch({ type: 'load', payload: {} });
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'onMessage',
      (native_msg: any) => {
        const msg = mapNativeMessage(native_msg);
        console.log('New message: ', msg);
        if (contacts[msg.contact] === undefined) {
          console.log('No contact. Adding...');
          addContact(defaultContact(msg.contact, tr));
        }
        messages_dispatch({ type: 'receive', payload: msg });
      },
    );

    return () => sub.remove();
  }, [contacts, tr]);

  return (
    <SafeAreaProvider>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardProvider>
        <AppContent />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const theme = useATheme();
  const [tr] = useTranslation();

  return (
    <SafeAreaView style={[styles.container, theme]} edges={['top', 'bottom']}>
      <RequiresPermissions
        permissions={permissions.base}
        text={tr('permissions_beg')}
      >
        <Navigation />
      </RequiresPermissions>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
