import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import {
  ReferenceModeSwitcher,
  fontScaleByReferenceMode,
  type ReferenceMode,
} from '../../components/reference/ReferenceModeSwitcher';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { paltaTheme } from '../../theme/paltaTheme';

const REFERENCE_PINS: readonly {
  left: `${number}%`;
  top: `${number}%`;
}[] = [
  { left: '22%', top: '30%' },
  { left: '61%', top: '39%' },
  { left: '45%', top: '66%' },
];

export function NeighborhoodReferenceScreen() {
  const [mode, setMode] = useState<ReferenceMode>('normal');
  const adaptive = useAdaptiveExperience(fontScaleByReferenceMode[mode]);

  return (
    <ScreenFrame title="Barrio" subtitle="Vitacura">
      <View style={{ gap: 14 }}>
        <ReferenceModeSwitcher mode={mode} onChange={setMode} />

        <Pressable
          accessibilityRole="search"
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: paltaTheme.color.border,
            borderRadius: paltaTheme.radius.control,
            backgroundColor: paltaTheme.color.surface,
            justifyContent: 'center',
            paddingHorizontal: 14,
          }}
        >
          <Text allowFontScaling style={{ color: paltaTheme.color.textSecondary }}>
            Buscar lugares y servicios
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <FilterChip label="Abierto ahora" />
          <FilterChip label="Verificado" />
          <FilterChip label="Filtros" />
        </View>

        <View
          accessibilityLabel="Mapa de referencia"
          style={{
            height:
              adaptive.textScaleClass === 'accessibility' ? 240 : 310,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: '#EEF0EB',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: '14%',
              top: '18%',
              width: '65%',
              height: 1,
              backgroundColor: '#D9DDD6',
              transform: [{ rotate: '18deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: '22%',
              top: '48%',
              width: '58%',
              height: 1,
              backgroundColor: '#D9DDD6',
              transform: [{ rotate: '-10deg' }],
            }}
          />

          {REFERENCE_PINS.map((position, index) => (
            <View
              key={String(index)}
              style={{
                position: 'absolute',
                left: position.left,
                top: position.top,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor:
                  index === 1
                    ? paltaTheme.color.brandPrimary
                    : paltaTheme.color.surface,
                borderWidth: 2,
                borderColor: paltaTheme.color.brandPrimary,
              }}
            />
          ))}

          <Pressable
            accessibilityRole="button"
            style={{
              position: 'absolute',
              bottom: 12,
              alignSelf: 'center',
              minHeight: paltaTheme.touch.minimum,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: paltaTheme.radius.pill,
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text allowFontScaling style={{ fontWeight: '700' }}>
              Buscar en esta zona
            </Text>
          </Pressable>
        </View>

        <View>
          <Text
            allowFontScaling
            style={{
              fontSize: 12,
              letterSpacing: 0.7,
              fontWeight: '800',
              color: paltaTheme.color.textMuted,
            }}
          >
            CERCA DE TI
          </Text>
          <SummaryListRow
            title="Taller López"
            meta="850 m"
            detail="Reparación de vehículos · Abierto"
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
            explicitActionLabel={
              adaptive.layout.preferTextLabelsOverIconOnly
                ? 'Ver negocio'
                : undefined
            }
            onPress={() => {}}
          />
          <SummaryListRow
            title="Farmacia Ahumada"
            meta="1,1 km"
            detail="Farmacia · Abierto hasta las 20:00"
            stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
            explicitActionLabel={
              adaptive.layout.preferTextLabelsOverIconOnly
                ? 'Ver lugar'
                : undefined
            }
            onPress={() => {}}
          />
        </View>
      </View>
    </ScreenFrame>
  );
}
