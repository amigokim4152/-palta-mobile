import { View } from 'react-native';
import {
  resolveBusinessActions,
  type BusinessCapability,
  type BusinessVerificationStatus,
} from '../../../../src/business/businessActionPolicy';
import { PaltaButton } from '../common/PaltaButton';

const labels: Record<BusinessCapability, string> = {
  call: 'Llamar',
  whatsapp: 'WhatsApp',
  save: 'Guardar',
  quote: 'Cotizar',
  reservation: 'Reservar',
  queue: 'Tomar turno',
  inquiry: 'Consultar',
  coupon: 'Cupón',
  pricing: 'Precios',
};

export function BusinessActionBar({
  capabilities,
  verificationStatus,
  onAction,
}: {
  capabilities: readonly BusinessCapability[];
  verificationStatus: BusinessVerificationStatus;
  onAction: (capability: BusinessCapability) => void;
}) {
  const actions = resolveBusinessActions({
    capabilities,
    verificationStatus,
  });

  return (
    <View style={{ gap: 10 }}>
      {actions
        .filter((action) => action.priority !== 'overflow')
        .map((action) => (
          <PaltaButton
            key={action.capability}
            label={labels[action.capability]}
            variant={
              action.priority === 'primary'
                ? 'primary'
                : 'secondary'
            }
            disabled={!action.enabled}
            onPress={() => onAction(action.capability)}
          />
        ))}
    </View>
  );
}
