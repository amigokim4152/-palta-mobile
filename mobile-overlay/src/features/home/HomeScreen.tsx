import { Text, View } from 'react-native';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { ScreenFrame } from '../../components/ScreenFrame';
import { ActionSurface } from '../../components/home/ActionSurface';
import {
  GlanceCluster,
  type GlanceItem,
} from '../../components/home/GlanceCluster';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import { paltaTheme } from '../../theme/paltaTheme';

const glanceItems: GlanceItem[] = [
  { id: 'weather', label: 'CLIMA', value: '23°', detail: '17° / 25°' },
  { id: 'metro', label: 'METRO L1', value: 'Normal' },
  { id: 'air', label: 'AIRE', value: 'Bueno' },
  { id: 'bus', label: 'BUS', value: 'Sin alerta' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      allowFontScaling
      style={{
        marginBottom: 5,
        fontSize: 11,
        letterSpacing: 0.75,
        fontWeight: '800',
        color: paltaTheme.color.textMuted,
      }}
    >
      {children}
    </Text>
  );
}

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();

  return (
    <ScreenFrame title="Palta">
      <View style={{ gap: 20 }}>
        <View>
          <Text
            allowFontScaling
            style={{
              fontSize: 25,
              lineHeight: 31,
              fontWeight: '700',
              color: paltaTheme.color.textPrimary,
            }}
          >
            {greetingForNow()}
          </Text>
          <Text
            allowFontScaling
            style={{
              marginTop: 2,
              fontSize: 14,
              lineHeight: 19,
              color: paltaTheme.color.textSecondary,
            }}
          >
            Vitacura
          </Text>
        </View>

        <View
          accessibilityRole="text"
          style={{
            marginTop: -10,
            alignSelf: 'flex-start',
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.surfaceMuted,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            allowFontScaling
            style={{
              fontSize: 11,
              lineHeight: 15,
              fontWeight: '700',
              color: paltaTheme.color.textMuted,
            }}
          >
            Vista de composición · datos de ejemplo
          </Text>
        </View>

        <GlanceCluster
          items={glanceItems}
          columns={adaptive.layout.columns}
          maxItems={adaptive.layout.maxInitialGlanceItems}
        />

        <View>
          <SectionLabel>AHORA</SectionLabel>
          <ActionSurface
            eyebrow="NUEVO"
            title="Llegó una respuesta a tu cotización"
            body="Taller López respondió sobre la reparación de tu vehículo."
          />
        </View>

        <View>
          <SectionLabel>EN CURSO</SectionLabel>
          <SummaryListRow
            title="Solicitud al taller"
            meta="En espera"
            detail="Esperando una respuesta definitiva."
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
          />
        </View>

        <View>
          <SectionLabel>PRÓXIMO</SectionLabel>
          <SummaryListRow
            title="Consulta médica"
            meta="Mañana · 10:30"
            detail="Revisa los documentos que debes llevar."
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
          />
          <SummaryListRow
            title="Documento del colegio"
            meta="20 sep"
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
          />
        </View>

        <View>
          <SectionLabel>PARA HOY</SectionLabel>
          <SummaryListRow
            title="Beneficio municipal cercano"
            meta="Vitacura"
            detail={
              adaptive.textScaleClass === 'accessibility'
                ? undefined
                : 'Sólo aparecerá cuando corresponda a tu situación.'
            }
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
          />
          <SummaryListRow
            title="Información local relevante para hoy"
            meta="Local"
            detail={
              adaptive.textScaleClass === 'accessibility'
                ? undefined
                : 'Noticias recientes y realmente útiles para tu zona.'
            }
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
          />
        </View>

        <Text
          allowFontScaling
          style={{
            paddingBottom: 24,
            fontSize: 13,
            lineHeight: 19,
            color: paltaTheme.color.textMuted,
          }}
        >
          Nada más requiere tu atención por ahora.
        </Text>
      </View>
    </ScreenFrame>
  );
}
