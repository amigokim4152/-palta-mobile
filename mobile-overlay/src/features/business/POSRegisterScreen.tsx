import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { createClientMutationId } from '../../../../src/api/retryPolicy';
import {
  appendPOSCustomLine,
  createPOSCustomLine,
  decrementPOSLine,
  summarizePOSDraftCart,
} from '../../../../src/commerce/posDraftCart';
import {
  decidePOSSurface,
  type POSDeviceProfile,
  type POSFormFactor,
  type POSPlatform,
} from '../../../../src/commerce/posSurfacePolicy';
import type { CommerceLine } from '../../../../src/commerce/transaction';
import { ScreenFrame } from '../../components/ScreenFrame';
import { paltaTheme } from '../../theme/paltaTheme';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

type Props = {
  businessId: string;
};

const paymentMethods: ReadonlyArray<{ key: PaymentMethod; label: string }> = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'other', label: 'Otro' },
];

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function platformForPOS(): POSPlatform {
  switch (Platform.OS) {
    case 'ios':
    case 'android':
    case 'web':
    case 'windows':
    case 'macos':
      return Platform.OS;
    default:
      return 'linux';
  }
}

function formFactorForWidth(width: number): POSFormFactor {
  if (width < 600) return 'phone';
  if (Platform.OS === 'web' && width >= 1024) return 'desktop';
  return 'tablet';
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: paltaTheme.color.surface,
        borderColor: paltaTheme.color.border,
        borderWidth: 1,
        borderRadius: paltaTheme.radius.surface,
        padding: paltaTheme.spacing.md,
        gap: paltaTheme.spacing.md,
      }}
    >
      {children}
    </View>
  );
}

function PaymentMethodButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: paltaTheme.touch.minimum,
        flex: 1,
        minWidth: 132,
        paddingHorizontal: 14,
        borderRadius: paltaTheme.radius.control,
        borderWidth: 1,
        borderColor: selected
          ? paltaTheme.color.brandPrimary
          : paltaTheme.color.border,
        backgroundColor: selected
          ? paltaTheme.color.brandSoft
          : paltaTheme.color.surface,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: selected
            ? paltaTheme.color.brandPrimary
            : paltaTheme.color.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CartLineRow({
  line,
  onDecrement,
}: {
  line: CommerceLine;
  onDecrement: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: paltaTheme.color.divider,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: paltaTheme.color.textPrimary }}>
          {line.title}
        </Text>
        <Text style={{ color: paltaTheme.color.textSecondary }}>
          {line.quantity} × {clp.format(line.unitAmountMinor)}
        </Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800' }}>
        {clp.format(line.lineAmountMinor)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quitar uno de ${line.title}`}
        onPress={onDecrement}
        style={{
          minWidth: paltaTheme.touch.minimum,
          minHeight: paltaTheme.touch.minimum,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: paltaTheme.radius.control,
          backgroundColor: paltaTheme.color.surfaceMuted,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700' }}>−</Text>
      </Pressable>
    </View>
  );
}

export function POSRegisterScreen({ businessId }: Props) {
  const { width } = useWindowDimensions();
  const [lines, setLines] = useState<CommerceLine[]>([]);
  const [amountText, setAmountText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const surface = useMemo(() => {
    const profile: POSDeviceProfile = {
      formFactor: formFactorForWidth(width),
      platform: platformForPOS(),
      viewportWidthCssPx: Math.max(width, 1),
      touch: true,
      keyboard: Platform.OS === 'web',
      pointer: Platform.OS === 'web',
      capabilities: new Set(),
    };
    return decidePOSSurface(profile);
  }, [width]);

  const summary = useMemo(() => summarizePOSDraftCart(lines), [lines]);
  const split = surface.layout !== 'single_column';

  function updateAmount(value: string) {
    setAmountText(value.replace(/[^0-9]/g, ''));
    setMessage(null);
  }

  function addQuickSale() {
    const amountMinor = Number.parseInt(amountText, 10);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      setMessage('Ingresa un monto válido mayor que $0.');
      return;
    }

    const line = createPOSCustomLine({
      id: createClientMutationId(Date.now(), Math.random()),
      amountMinor,
    });
    setLines((current) => appendPOSCustomLine(current, line));
    setAmountText('');
    setPaymentMethod(null);
    setMessage(null);
  }

  function preparePayment() {
    if (summary.totalAmountMinor <= 0 || !paymentMethod) return;
    const label = paymentMethods.find((method) => method.key === paymentMethod)?.label;
    setMessage(
      `Pago preparado: ${label ?? paymentMethod} · ${clp.format(summary.totalAmountMinor)}. Aún no se enviará ningún cobro hasta activar el proveedor de pago.`,
    );
  }

  const salePanel = (
    <Panel>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Venta rápida
        </Text>
        <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
          Ingresa un monto. El catálogo se conectará sin cambiar este flujo.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
        <View
          style={{
            flex: 1,
            minHeight: 58,
            borderWidth: 1,
            borderColor: paltaTheme.color.border,
            borderRadius: paltaTheme.radius.control,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>CLP</Text>
          <TextInput
            accessibilityLabel="Monto de venta"
            value={amountText}
            onChangeText={updateAmount}
            keyboardType="number-pad"
            placeholder="0"
            returnKeyType="done"
            onSubmitEditing={addQuickSale}
            style={{
              padding: 0,
              fontSize: 24,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={addQuickSale}
          style={{
            minWidth: 96,
            minHeight: 58,
            borderRadius: paltaTheme.radius.control,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: paltaTheme.color.brandPrimary,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Agregar</Text>
        </Pressable>
      </View>

      <View
        style={{
          borderRadius: paltaTheme.radius.control,
          backgroundColor: paltaTheme.color.surfaceMuted,
          padding: 12,
        }}
      >
        <Text style={{ color: paltaTheme.color.textSecondary }}>
          Modo: {surface.mode === 'mobile_quick' ? 'rápido' : 'registro'} · {surface.density === 'compact' ? 'compacto' : 'cómodo'}
        </Text>
      </View>
    </Panel>
  );

  const cartPanel = (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Venta actual
        </Text>
        <Text style={{ color: paltaTheme.color.textSecondary }}>
          {summary.itemCount} {summary.itemCount === 1 ? 'ítem' : 'ítems'}
        </Text>
      </View>

      {lines.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: paltaTheme.color.textPrimary }}>
            Aún no hay productos
          </Text>
          <Text style={{ color: paltaTheme.color.textSecondary, textAlign: 'center' }}>
            Agrega una venta rápida para iniciar.
          </Text>
        </View>
      ) : (
        <View>
          {lines.map((line) => (
            <CartLineRow
              key={line.id}
              line={line}
              onDecrement={() => {
                setLines((current) => decrementPOSLine(current, line.id));
                setPaymentMethod(null);
                setMessage(null);
              }}
            />
          ))}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: 4,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Total</Text>
        <Text style={{ fontSize: 30, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
          {clp.format(summary.totalAmountMinor)}
        </Text>
      </View>
    </Panel>
  );

  const paymentPanel = (
    <Panel>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Cobrar
        </Text>
        <Text style={{ color: paltaTheme.color.textSecondary }}>
          Elige el medio. Tarjeta no pregunta débito/crédito si el terminal lo resuelve.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {paymentMethods.map((method) => (
          <PaymentMethodButton
            key={method.key}
            label={method.label}
            selected={paymentMethod === method.key}
            onPress={() => {
              setPaymentMethod(method.key);
              setMessage(null);
            }}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !paymentMethod || summary.totalAmountMinor <= 0 }}
        disabled={!paymentMethod || summary.totalAmountMinor <= 0}
        onPress={preparePayment}
        style={{
          minHeight: 58,
          borderRadius: paltaTheme.radius.control,
          backgroundColor: paltaTheme.color.brandPrimary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: !paymentMethod || summary.totalAmountMinor <= 0 ? 0.38 : 1,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>
          Continuar · {clp.format(summary.totalAmountMinor)}
        </Text>
      </Pressable>

      {message ? (
        <View
          style={{
            padding: 12,
            borderRadius: paltaTheme.radius.control,
            backgroundColor: paltaTheme.color.avocadoCream,
          }}
        >
          <Text style={{ color: paltaTheme.color.textPrimary, lineHeight: 20 }}>{message}</Text>
        </View>
      ) : null}
    </Panel>
  );

  return (
    <ScreenFrame
      title="POS"
      subtitle="Palta Business · venta rápida"
      scroll
    >
      <View style={{ gap: paltaTheme.spacing.md }}>
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: paltaTheme.radius.pill,
            alignSelf: 'flex-start',
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>
            Comercio protegido · {businessId.slice(0, 8)}…
          </Text>
        </View>

        {split ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: paltaTheme.spacing.md }}>
            <View style={{ flex: 1.2, gap: paltaTheme.spacing.md }}>
              {salePanel}
              {paymentPanel}
            </View>
            <View style={{ flex: 1 }}>{cartPanel}</View>
          </View>
        ) : (
          <>
            {salePanel}
            {cartPanel}
            {paymentPanel}
          </>
        )}
      </View>
    </ScreenFrame>
  );
}
