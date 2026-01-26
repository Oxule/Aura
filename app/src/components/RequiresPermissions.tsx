import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Text,
  View,
} from 'react-native';
import useATheme, { style_h3 } from '../theme.ts';
import { AButton } from '../button.tsx';
import { useTranslation } from '../translations/translations.ts';

export default function RequiresPermissions({ permissions, children, text }) {
  const [hasPermissions, setHasPermissions] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const appState = useRef(AppState.currentState);
  const theme = useATheme();

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.requestMultiple(
        permissions.android,
      );

      const allGranted = Object.values(status).every(
        res => res === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (allGranted) {
        setHasPermissions(true);
        setIsBlocked(false);
      } else {
        const blocked = Object.values(status).some(
          res => res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        );
        setIsBlocked(blocked);
      }
    }
  };

  useEffect(() => {
    checkPermissions();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkPermissions();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const [tr] = useTranslation();

  if (!hasPermissions) {
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.backgroundColor,
          padding: 40,
        }}
      >
        <Text
            style={[
              style_h3(theme),
              { textAlign: 'center', marginBottom: 10 },
            ]}
        >
          {text}
        </Text>
        {isBlocked && (
          <>
            <Text
              style={{
                color: 'red',
                textAlign: 'center',
                marginBottom: 20,
                fontSize: 14,
              }}
            >
              {tr('permissions_perma')}
            </Text>
            <AButton
                type={'primary'}
                title={tr('permissions_settings')}
                onPress={() => Linking.openSettings()}
            />
          </>
        )}

        {/*{isBlocked && (
                    <TouchableOpacity style={{marginTop: 20}} onPress={checkPermissions}>
                        <Text style={{color: theme.color, textDecorationLine: 'underline'}}>
                            Retry check
                        </Text>
                    </TouchableOpacity>
                )}*/}
      </View>
    );
  }

  return children;
}
