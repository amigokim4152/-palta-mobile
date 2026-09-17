import { View } from 'react-native';
import {
  resolveBusinessActions,
  type BusinessCapability,
  type BusinessVerificationStatus,
} from '../../../../src/business/businessActionPolicy';
import { PaltaButton } from '../common/PaltaButton';

const labels: Record<Exclude<BusinessCapability, 'save' | 'follow'>, string> = {
  call: 'Llamar',
  whatsapp: 'WhatsApp',
  quote: 'Cotizar',
  reservation: 'Reservar',
  queue: 'Tomar turno',
  inquiry: 'Consultar',
  coupon: 'Cupón',
  pricing: 'Precios',
};

function actionLabel(
  capability: BusinessCapability,
  relationship: { saved: boolean; following: boolean },
): string {
  if (capability === 'save') return relationship.saved ? 'Guardado' : 'Guardar';
  if (capability === 'follow') return relationship.following ? 'Siguiendo' : 'Seguir';
  return labels[capability];
}

export function BusinessActionBar({
  capabilities,
  verificationStatus,
  relationship = { saved: false, following: false },
  onAction,
}: {
  capabilities: readonly BusinessCapability[];
  verificationStatus: BusinessVerificationStatus;
  relationship?: { saved: boolean; following: boolean };
  onAction: (capability: BusinessCapability) => void;
}) {
  const actions = resolveBusinessActions({
    capabilities,
    verificationStatus,
  });

  const visible = actions.filter(
    (action) =>
      action.priority !== 'overflow' ||
      action.capability === 'save' ||
      action.capability === 'follow',
  );

  return (
    <View style={{ gap: 10 }}>
      {visible.map((action) => (
        <PaltaButton
          key={action.capability}
          label={actionLabel(action.capability, relationship)}
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
