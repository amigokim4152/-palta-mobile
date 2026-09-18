import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { paltaTheme } from '../../theme/paltaTheme';

function ActionButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 50,
        marginTop: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: secondary ? 1 : 0,
        borderColor: paltaTheme.color.divider,
        backgroundColor: secondary ? paltaTheme.color.surface : paltaTheme.color.brandPrimary,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '800',
          color: secondary ? paltaTheme.color.textPrimary : paltaTheme.color.surface,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function BusinessRegistrationReceivedScreen() {
  const params = useLocalSearchParams<{
    registrationId?: string | string[];
    businessName?: string | string[];
    status?: string | string[];
  }>();

  const registrationId = firstParam(params.registrationId);
  const businessName = firstParam(params.businessName);
  const status = firstParam(params.status);
  const matchedExisting = status === 'matched_existing';
  const shortId = registrationId ? registrationId.slice(0, 8).toUpperCase() : '';

  return (
    <ScreenFrame
      title="Registro recibido"
      subtitle="Palta revisará la ficha antes de habilitar la administración"
    >
      <View
        style={{
          padding: 18,
          borderRadius: 18,
          backgroundColor: paltaTheme.color.surface,
          borderWidth: 1,
          borderColor: paltaTheme.color.divider,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 21,
            lineHeight: 28,
            fontWeight: '900',
            color: paltaTheme.color.textPrimary,
          }}
        >
          {businessName || 'Tu negocio'}
        </Text>

        <Text
          style={{
            marginTop: 10,
            fontSize: 16,
            lineHeight: 24,
            color: paltaTheme.color.textPrimary,
          }}
        >
          {matchedExisting
            ? 'Encontramos una ficha que puede corresponder a tu negocio. No crearemos un duplicado: revisaremos la solicitud de acceso.'
            : 'Recibimos los datos básicos. La ficha queda pendiente mientras verificamos al responsable y revisamos posibles duplicados.'}
        </Text>

        <View
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            Pendiente de verificación
          </Text>
          <Text style={{ marginTop: 6, lineHeight: 20, color: paltaTheme.color.textMuted }}>
            Todavía no se habilitan cupones, promociones ni cambios sensibles. Eso ocurre después de verificar al propietario o administrador.
          </Text>
        </View>

        {shortId ? (
          <Text style={{ marginTop: 14, fontSize: 13, color: paltaTheme.color.textMuted }}>
            Código de registro: {shortId}
          </Text>
        ) : null}
      </View>

      <ActionButton
        label="Volver a Negocios"
        onPress={() => router.replace('/local-businesses')}
      />
      <ActionButton
        label="Ir al inicio"
        onPress={() => router.replace('/')}
        secondary
      />
    </ScreenFrame>
  );
}
