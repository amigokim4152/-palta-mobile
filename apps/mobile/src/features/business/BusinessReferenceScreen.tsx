import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { PaltaButton } from '../../components/common/PaltaButton';
import {
  ReferenceModeSwitcher,
  fontScaleByReferenceMode,
  type ReferenceMode,
} from '../../components/reference/ReferenceModeSwitcher';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { paltaTheme } from '../../theme/paltaTheme';

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: paltaTheme.color.divider,
        marginVertical: 20,
      }}
    />
  );
}

export function BusinessReferenceScreen() {
  const [mode, setMode] = useState<ReferenceMode>('normal');
  const adaptive = useAdaptiveExperience(fontScaleByReferenceMode[mode]);

  return (
    <ScreenFrame title="Taller López" subtitle="Reparación de vehículos">
      <View style={{ gap: 14 }}>
        <ReferenceModeSwitcher mode={mode} onChange={setMode} />

        <View style={{ gap: 5 }}>
          <Text
            allowFontScaling
            style={{
              fontSize: 28,
              lineHeight: 34,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          >
            Taller López
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: 16,
              lineHeight: 23,
              color: paltaTheme.color.textSecondary,
            }}
          >
            Abierto · 850 m
          </Text>
        </View>

        <PaltaButton label="Solicitar cotización" onPress={() => {}} />

        <View
          style={{
            flexDirection:
              adaptive.layout.stackPrimaryActions ? 'column' : 'row',
            gap: 8,
          }}
        >
          {['WhatsApp', 'Llamar', 'Cómo llegar'].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              style={{
                minHeight: paltaTheme.touch.minimum,
                justifyContent: 'center',
                paddingHorizontal: 10,
              }}
            >
              <Text
                allowFontScaling
                style={{
                  fontWeight: '700',
                  color: paltaTheme.color.brandPrimary,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Divider />

        <View style={{ gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800' }}>
            Servicios
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: paltaTheme.color.textSecondary,
            }}
          >
            Frenos · Motor · Mantención periódica
          </Text>
        </View>

        <Divider />

        <View style={{ gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800' }}>
            Horario
          </Text>
          <Text allowFontScaling style={{ fontSize: 16, lineHeight: 24 }}>
            Hoy · 09:00–18:30
          </Text>
          <Text
            allowFontScaling
            style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}
          >
            Información pública · revisar antes de viajar
          </Text>
        </View>

        <Divider />

        <View style={{ gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800' }}>
            Ubicación
          </Text>
          <View
            style={{
              height: adaptive.textScaleClass === 'accessibility' ? 150 : 190,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: '#EEF0EB',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text allowFontScaling style={{ color: paltaTheme.color.textSecondary }}>
              Vista de mapa
            </Text>
          </View>
        </View>

        <Divider />

        <Pressable
          accessibilityRole="button"
          style={{
            minHeight: paltaTheme.touch.minimum,
            justifyContent: 'center',
          }}
        >
          <Text
            allowFontScaling
            style={{
              fontWeight: '700',
              color: paltaTheme.color.brandPrimary,
            }}
          >
            Ver información completa
          </Text>
        </Pressable>
      </View>
    </ScreenFrame>
  );
}
