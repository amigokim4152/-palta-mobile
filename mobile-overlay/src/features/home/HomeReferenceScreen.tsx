import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { ActionSurface } from '../../components/home/ActionSurface';
import {
  GlanceCluster,
  type GlanceItem,
} from '../../components/home/GlanceCluster';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { paltaTheme } from '../../theme/paltaTheme';

export type ReferenceMode = 'normal' | 'large' | 'accessibility';

const fontScaleByMode: Record<ReferenceMode, number> = {
  normal: 1,
  large: 1.35,
  accessibility: 1.9,
};

const glanceItems: GlanceItem[] = [
  { id: 'weather', label: 'HOY', value: '23° · despejado', detail: '17° / 25°' },
  { id: 'metro', label: 'METRO L1', value: 'Normal' },
  { id: 'fx', label: 'USD', value: '$923' },
  { id: 'air', label: 'AIRE', value: 'Bueno' },
];

export function HomeReferenceScreen() {
  const [mode, setMode] = useState<ReferenceMode>('normal');
  const adaptive = useAdaptiveExperience(fontScaleByMode[mode]);

  const secondary = useMemo(
    () => [
      {
        id: 'appointment',
        title: 'Consulta médica',
        meta: 'Mañana · 10:30',
        detail: 'Revisa los documentos que debes llevar.',
      },
      {
        id: 'school',
        title: 'Documento del colegio',
        meta: '20 sep',
      },
      {
        id: 'vehicle',
        title: 'Revisión del vehículo',
        meta: '5 oct',
      },
    ],
    [],
  );

  const visibleSecondary = secondary.slice(
    0,
    adaptive.layout.maxInitialSecondaryItems,
  );
  const hiddenSecondary = secondary.length - visibleSecondary.length;

  return (
    <ScreenFrame
      title="Palta"
      subtitle={`Reference · ${adaptive.textScaleClass}`}
    >
      <View
        style={{
          marginHorizontal: -18,
          marginTop: -18,
          paddingHorizontal: 18,
          paddingVertical: 8,
          backgroundColor: paltaTheme.color.canvas,
        }}
      >
        <View
          accessibilityLabel="Modo de prueba"
          style={{
            flexDirection:
              adaptive.textScaleClass === 'accessibility'
                ? 'column'
                : 'row',
            gap: 8,
          }}
        >
          {(['normal', 'large', 'accessibility'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === item }}
              onPress={() => setMode(item)}
              style={{
                minHeight: paltaTheme.touch.minimum,
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.pill,
                borderWidth: 1,
                borderColor:
                  mode === item
                    ? paltaTheme.color.brandPrimary
                    : paltaTheme.color.border,
                backgroundColor:
                  mode === item
                    ? paltaTheme.color.brandSoft
                    : paltaTheme.color.surface,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  color: paltaTheme.color.textPrimary,
                  fontWeight: '700',
                }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 28 }}>
        <View>
          <Text
            allowFontScaling
            style={{
              fontSize: 28,
              lineHeight: 35,
              fontWeight: '700',
              color: paltaTheme.color.textPrimary,
            }}
          >
            Buenos días
          </Text>
          <Text
            allowFontScaling
            style={{
              marginTop: 3,
              color: paltaTheme.color.textSecondary,
            }}
          >
            Vitacura
          </Text>
        </View>

        <GlanceCluster
          items={glanceItems}
          columns={adaptive.layout.columns}
          maxItems={adaptive.layout.maxInitialGlanceItems}
          accessibilityLabel="Información rápida"
          formatMoreLabel={(count) => `Ver ${count} más`}
          onMore={() => {}}
        />

        <View style={{ gap: 10 }}>
          <Text
            allowFontScaling
            style={{
              fontSize: 12,
              letterSpacing: 0.7,
              fontWeight: '800',
              color: paltaTheme.color.textMuted,
            }}
          >
            AHORA
          </Text>
          <ActionSurface
            eyebrow="NUEVO"
            title="Llegó una respuesta a tu cotización"
            body="Taller López respondió sobre la reparación de tu vehículo."
            actionLabel="Ver respuesta"
            onPress={() => {}}
          />
        </View>

        <View>
          <Text
            allowFontScaling
            style={{
              marginBottom: 4,
              fontSize: 12,
              letterSpacing: 0.7,
              fontWeight: '800',
              color: paltaTheme.color.textMuted,
            }}
          >
            PRÓXIMO
          </Text>

          {visibleSecondary.map((item) => (
            <SummaryListRow
              key={item.id}
              title={item.title}
              meta={item.meta}
              detail={item.detail}
              stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
              explicitActionLabel={
                adaptive.layout.preferTextLabelsOverIconOnly
                  ? 'Ver detalle'
                  : undefined
              }
              onPress={() => {}}
            />
          ))}

          {hiddenSecondary > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {}}
              style={{
                minHeight: paltaTheme.touch.minimum,
                justifyContent: 'center',
                paddingVertical: 10,
              }}
            >
              <Text
                allowFontScaling
                style={{
                  color: paltaTheme.color.brandPrimary,
                  fontWeight: '800',
                }}
              >
                Ver {hiddenSecondary} más
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View>
          <Text
            allowFontScaling
            style={{
              marginBottom: 4,
              fontSize: 12,
              letterSpacing: 0.7,
              fontWeight: '800',
              color: paltaTheme.color.textMuted,
            }}
          >
            PARA HOY
          </Text>

          <SummaryListRow
            title="Qué cambia con la nueva información del transporte"
            meta="12 min"
            detail={
              adaptive.textScaleClass === 'normal'
                ? 'Resumen breve y directo; la lectura completa se abre en una superficie dedicada.'
                : undefined
            }
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
            explicitActionLabel={
              adaptive.layout.preferTextLabelsOverIconOnly
                ? 'Leer'
                : undefined
            }
            onPress={() => {}}
          />

          <SummaryListRow
            title="Panoramas cercanos para el fin de semana"
            meta="Vitacura"
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
            explicitActionLabel={
              adaptive.layout.preferTextLabelsOverIconOnly
                ? 'Ver'
                : undefined
            }
            onPress={() => {}}
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
