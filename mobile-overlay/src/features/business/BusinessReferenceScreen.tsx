import { useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { LocalResultCard } from '../../components/LocalResultCard';
import { BusinessActionBar } from '../../components/business/BusinessActionBar';
import { SectionHeading } from '../../components/common/SectionHeading';
import {
  ReferenceModeSwitcher,
  fontScaleByReferenceMode,
  type ReferenceMode,
} from '../../components/reference/ReferenceModeSwitcher';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { paltaTheme } from '../../theme/paltaTheme';

function SampleLabel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={{ gap: paltaTheme.spacing.xxs }}>
      <Text
        allowFontScaling
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: paltaTheme.color.brandPrimary,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <Text
        allowFontScaling
        style={{
          lineHeight: 20,
          color: paltaTheme.color.textSecondary,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export function BusinessReferenceScreen() {
  const [mode, setMode] = useState<ReferenceMode>('normal');
  const adaptive = useAdaptiveExperience(fontScaleByReferenceMode[mode]);

  return (
    <ScreenFrame
      title="Negocios · referencia"
      subtitle="Dos muestras para mantener la pantalla tan clara como la lógica"
    >
      <View style={{ gap: paltaTheme.spacing.xl }}>
        <ReferenceModeSwitcher mode={mode} onChange={setMode} />

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SampleLabel
            title="Muestra A · resultado de búsqueda"
            body="Debe permitir decidir en pocos segundos si vale la pena abrir el negocio. Foto real si existe, estado actual, distancia o zona, servicios y un solo motivo vigente."
          />
          <View
            style={{
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.sheet,
              backgroundColor: paltaTheme.color.surface,
              paddingHorizontal: paltaTheme.spacing.sm,
            }}
          >
            <LocalResultCard
              name="Panadería Los Alerces"
              meta="Abierto ahora · Verificado"
              distance="450 m"
              serviceLabels={['Panadería', 'Café']}
              highlight="10% en café para llevar"
              onPress={() => {}}
            />
            <LocalResultCard
              name="Gasfitería Andes"
              meta="Horario por confirmar"
              distance="Zona de atención"
              serviceLabels={['Gasfitería', 'Destape']}
              highlight="Cotización disponible"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SampleLabel
            title="Muestra B · primera vista del perfil"
            body="Antes de bajar por la ficha, la persona debe entender qué es, si puede usarlo ahora y qué puede hacer. El resto aparece después."
          />

          <View
            style={{
              gap: paltaTheme.spacing.sm,
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.sheet,
              padding: paltaTheme.spacing.sm,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <View
              style={{
                height: adaptive.textScaleClass === 'accessibility' ? 150 : 190,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                allowFontScaling
                style={{
                  color: paltaTheme.color.brandPrimary,
                  fontWeight: '800',
                }}
              >
                FOTO REAL DEL NEGOCIO
              </Text>
            </View>

            <View style={{ gap: paltaTheme.spacing.xxs }}>
              <Text
                allowFontScaling
                style={{
                  fontSize: 24,
                  lineHeight: 30,
                  fontWeight: '800',
                  color: paltaTheme.color.textPrimary,
                }}
              >
                Taller López
              </Text>
              <Text
                allowFontScaling
                style={{ color: paltaTheme.color.textSecondary }}
              >
                Taller mecánico · Verificado
              </Text>
            </View>

            <View
              style={{
                borderRadius: paltaTheme.radius.surface,
                padding: paltaTheme.spacing.sm,
                gap: paltaTheme.spacing.xxs,
                backgroundColor: paltaTheme.color.surfaceMuted,
              }}
            >
              <Text
                allowFontScaling
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: paltaTheme.color.brandPrimary,
                }}
              >
                Abierto ahora · 850 m
              </Text>
              <Text allowFontScaling style={{ fontWeight: '700' }}>
                Mantención · Frenos
              </Text>
            </View>

            <SectionHeading
              title="¿Qué quieres hacer?"
              subtitle="Sólo las acciones que este negocio realmente ofrece."
            />
            <BusinessActionBar
              capabilities={['quote', 'whatsapp', 'call', 'save', 'follow']}
              verificationStatus="verified"
              relationship={{ saved: false, following: false }}
              onAction={() => {}}
            />

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: paltaTheme.color.divider,
                paddingTop: paltaTheme.spacing.sm,
                gap: paltaTheme.spacing.xxs,
              }}
            >
              <Text allowFontScaling style={{ fontWeight: '800' }}>
                Después de esta primera vista
              </Text>
              <Text
                allowFontScaling
                style={{
                  lineHeight: 20,
                  color: paltaTheme.color.textSecondary,
                }}
              >
                Servicios · beneficio · opiniones verificadas · novedades · horario · zona · enlaces externos · correcciones.
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            borderRadius: paltaTheme.radius.surface,
            padding: paltaTheme.spacing.sm,
            backgroundColor: paltaTheme.color.surfaceMuted,
            gap: paltaTheme.spacing.xxs,
          }}
        >
          <Text allowFontScaling style={{ fontWeight: '800' }}>
            Regla de referencia
          </Text>
          <Text
            allowFontScaling
            style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}
          >
            Aprendemos de la rapidez de lectura de Karrot, pero Palta debe explicar mejor qué se puede usar ahora y mantener el contexto hasta Care. No copiamos su identidad visual.
          </Text>
        </View>
      </View>
    </ScreenFrame>
  );
}
