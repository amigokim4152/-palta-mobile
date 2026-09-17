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

  const relationshipActions = actions.filter(
    (action) => action.capability === 'save' || action.capability === 'follow',
  );
  const directActions = actions
    .filter(
      (action) =>
        action.capability !== 'save' &&
        action.capability !== 'follow' &&
        action.priority !== 'overflow',
    )
    .slice(0, 3);

  return (
    <View style={{ gap: 10 }}>
      {directActions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {directActions.map((action, index) => (
            <PaltaButton
              key={action.capability}
              label={actionLabel(action.capability, relationship)}
              variant={index === 0 ? 'primary' : 'secondary'}
              disabled={!action.enabled}
              onPress={() => onAction(action.capability)}
              style={{ flexGrow: 1, flexBasis: directActions.length === 1 ? '100%' : '44%' }}
            />
          ))}
        </View>
      ) : null}

      {relationshipActions.length ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {relationshipActions.map((action) => (
            <PaltaButton
              key={action.capability}
              label={actionLabel(action.capability, relationship)}
              variant="quiet"
              disabled={!action.enabled}
              onPress={() => onAction(action.capability)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
