import React, {useState, useRef, useMemo, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    PanResponder,
    Vibration,
    LayoutAnimation,
    Platform,
    TouchableOpacity,
    Animated
} from 'react-native';
import { Spacings } from '../theme';
import { useTranslation } from '../translations/translations';

const triggerHaptic = (type: 'tick' | 'impact') => {
    if (Platform.OS === 'ios') {
        Vibration.vibrate(type === 'impact' ? 10 : 1);
    } else {
        Vibration.vibrate(type === 'impact' ? 35 : 5);
    }
};

export const targetBits = {
    direct: {
        local: 8,
        global: 12
    },
    broadcast: {
        local: 10,
        global: 14
    }
}

export default function PowSubHeader({ bits, setBits, theme, profile }: {bits: number, setBits: (b:number)=>void, theme: any, profile: "direct"|"broadcast"}) {
    const [tr] = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const p = targetBits[profile]

    const [bitsState, setBitsState] = useState<number>(Math.max(bits, p.local));

    const diff = p.global-p.local+3

    const animPos = useRef(new Animated.Value(((bitsState - p.local) / diff) * 100)).current;

    console.log(animPos)

    const containerWidth = useRef(0);
    const lastBits = useRef(bits);

    const isGlobal = bitsState >= p.global;
    const ttl = Math.pow(2, Math.min(bitsState - (isGlobal ? p.global : p.local), 3));
    const powTime = (1.75 * Math.pow(2, bitsState - targetBits.direct.local));

    const snapToBit = (bitValue: number) => {
        const targetPercent = ((bitValue - p.local) / diff) * 100;
        Animated.spring(animPos, {
            toValue: targetPercent,
            useNativeDriver: false,
            friction: 7,
            tension: 40
        }).start();
    };

    const handleCoordUpdate = (pageX: number, isFinal: boolean = false) => {
        if (containerWidth.current === 0) return;

        const x = pageX - Spacings.major;
        const rawPercent = Math.max(0, Math.min(1, x / containerWidth.current));
        const currentBit = Math.round(p.local + rawPercent * diff);

        if (!isFinal) {
            animPos.setValue(rawPercent * 100);
            if (currentBit !== lastBits.current) {
                lastBits.current = currentBit;
                setBitsState(currentBit);
                triggerHaptic('impact');
            }
        } else {
            lastBits.current = currentBit;
            setBitsState(currentBit);
            setBits(currentBit);
            snapToBit(currentBit);
            triggerHaptic('impact');
        }
    };

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (evt) => {
            handleCoordUpdate(evt.nativeEvent.pageX);
        },

        onPanResponderMove: (evt) => {
            handleCoordUpdate(evt.nativeEvent.pageX);
        },

        onPanResponderRelease: (evt) => {
            handleCoordUpdate(evt.nativeEvent.pageX, true);
        },

        onPanResponderTerminationRequest: () => false,
    }), [theme]);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor, borderBottomColor: theme.dim + '20' }]}>
            <View style={styles.topRow}>
                <View style={styles.modeInfo}>
                    <Text style={styles.icon}>{isGlobal ? '🌐' : '📍'}</Text>
                    <Text style={[styles.modeName, { color: isGlobal ? theme.hard : theme.baseAccent }]}>
                        {isGlobal ? tr('pow_global') : tr('pow_local')}
                    </Text>
                </View>

                <View style={styles.rightGroup}>
                    <Text style={[styles.timeValue, { color: theme.color }]}>{ttl}{tr("metric_hour_short")}</Text>
                    <TouchableOpacity onPress={toggleExpand} style={styles.expandBtn}>
                        <Text style={[styles.expandIcon, { color: theme.dim, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>▾</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View
                style={styles.sliderWrapper}
                onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
                {...panResponder.panHandlers}
            >
                <View style={[styles.trackBase, { backgroundColor: theme.dim + '20' }]}>
                    <View style={[styles.zone, { width: '50%', backgroundColor: theme.baseAccent + '40' }]} />
                    {/*<View style={styles.trackDivider} />*/}
                    <View style={[styles.zone, { flex: 1, backgroundColor: theme.hard + '40' }]} />
                </View>

                <View style={styles.ticksOverlay}>
                    {[...Array(8)].map((_, i) => (
                        <View key={i} style={[styles.tick, { backgroundColor: theme.dim + 'BB' }]} />
                    ))}
                </View>

                <Animated.View style={[styles.knob, {
                    left: animPos.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%']
                    }),
                    //backgroundColor: (isGlobal ? theme.hard : theme.accent) + "BB",
                    backgroundColor: "white",
                    borderColor: isGlobal ? theme.hard : theme.baseAccent
                }]} />
            </View>

            <View style={styles.absoluteWrapper}>
                {expanded && (
                    <View style={[styles.expandedContent, { backgroundColor: theme.backgroundColor, borderBottomColor: theme.dim + '20' }]}>
                        <View style={[styles.infoBlock, { alignItems: 'flex-start' }]}>
                            <View style={{ alignItems: 'center', width: 52, marginRight: 16 }}>
                                <View style={[styles.circleLabel, { backgroundColor: isGlobal ? theme.hard + '40' : theme.baseAccent + '40' }]}>
                                    <Text style={[styles.circleValue, { color: isGlobal ? theme.hard : theme.baseAccent }]}>{bitsState}</Text>
                                    <Text style={[styles.circleSub, { color: isGlobal ? theme.hard : theme.baseAccent }]}>{tr('pow_bits')}</Text>
                                </View>
                                <Text style={{ color: theme.dim, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                                    ~{powTime.toFixed(1)}{tr("metric_sec_short")}
                                </Text>
                            </View>
                            <View style={styles.blockText}>
                                <Text style={[styles.detailTitle, { color: theme.text || theme.color, marginTop: 2 }]}>{tr('pow_mode_strategy')}</Text>
                                <Text style={[styles.detailText, { color: theme.color, marginTop: 4 }]}>
                                    {isGlobal ? tr('pow_global_desc') : tr('pow_local_desc')}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacings.major,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    absoluteWrapper: {
        position: 'relative',
        zIndex: 100,
    },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeInfo: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 14, marginRight: 8 },
  modeName: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  rightGroup: { flexDirection: 'row', alignItems: 'center' },
  timeValue: { fontSize: 16, fontWeight: 'bold', marginRight: 4 },
  expandBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
  },
  sliderWrapper: { height: 36, justifyContent: 'center' },
  trackBase: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  zone: { height: '100%' },
  trackDivider: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  ticksOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 3,
    pointerEvents: 'none',
  },
  tick: { width: 1.2, height: 7, borderRadius: 0.5 },
  knob: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 4,
    marginLeft: -13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
    expandedContent: {
        position: 'absolute',
        top: 0,
        left: -Spacings.major,
        right: -Spacings.major,
        paddingHorizontal: Spacings.major,
        paddingBottom: 16,
        paddingTop: 8,
        borderBottomWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
  infoBlock: { flexDirection: 'row' },
  circleLabel: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValue: { fontSize: 15, fontWeight: 'bold' },
  circleSub: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  blockText: { flex: 1 },
  detailTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: { fontSize: 13, lineHeight: 18, opacity: 0.8 },
});