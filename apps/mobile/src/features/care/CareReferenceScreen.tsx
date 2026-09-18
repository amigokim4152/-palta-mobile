import { useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { CareTimeline } from '../../components/care/CareTimeline';
import { ActionSurface } from '../../components/home/ActionSurface';
import {
  ReferenceModeSwitcher,
  fontScaleByReferenceMode,
  type ReferenceMode,
} from '../../components/reference/ReferenceModeSwitcher';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { paltaTheme } from '../../theme/paltaTheme';

export function CareReferenceScreen() {
  const [mode, setMode] = useState<ReferenceMode>('normal');
  const adaptive = useAdaptiveExperience(fontScaleByReferenceMode[mode]);

  return (
    <ScreenFrame title="Reparación del vehículo" subtitle="Seguimiento">
      <View style={{ gap: 22 }}>
        <ReferenceModeSwitcher mode={mode} onChange={setMode} />

        <View style={{ gap: 4 }}>
          <Text
            allowFontScaling
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: paltaTheme.color.textSecondary,
            }}
          >
            AHORA
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: 28,
              lineHeight: 35,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          >
            Esperando respuestas
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: 16,
              lineHeight: 23,
              color: paltaTheme.color.textSecondary,
            }}
          >
            1 de 3 talleres ya respondió.
          </Text>
        </View>

        <ActionSurface
          eyebrow="RESPUESTA NUEVA"
          title="Taller López"
          body="$85.000 · disponibilidad hoy"
          actionLabel="Ver respuesta"
          onPress={() => {}}
        />

        {adaptive.textScaleClass === 'accessibility' ? (
          <View style={{ gap: 8 }}>
            <Text allowFontScaling style={{ fontSize: 18, fontWeight: '800' }}>
              Progreso
            </Text>
            <Text
              allowFontScaling
              style={{ color: paltaTheme.color.textSecondary }}
            >
              Solicitud enviada · esperando respuestas.
            </Text>
            <Text
              allowFontScaling
              style={{
                fontWeight: '700',
                color: paltaTheme.color.brandPrimary,
              }}
            >
              Ver proceso completo
            </Text>
          </View>
        ) : (
          <CareTimeline state="wait" />
        )}

        <View
          style={{
            paddingTop: 16,
            borderTopWidth: 1,
            borderColor: paltaTheme.color.divider,
          }}
        >
          <Text
            allowFontScaling
            style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}
          >
            Palta te avisará cuando llegue otra respuesta importante.
          </Text>
        </View>
      </View>
    </ScreenFrame>
  );
}
