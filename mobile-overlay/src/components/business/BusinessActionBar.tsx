import { View } from 'react-native';
import type { UiKey } from '../../../../src/localization/index';
import {
  resolveBusinessActions,
  type BusinessCapability,
  type BusinessVerificationStatus,
} from '../../../../src/business/businessActionPolicy';
import { useLocalization } from '../../providers/LocalizationProvider';
import { PaltaButton } from '../common/PaltaButton';

const labelKeys: Record<BusinessCapability, UiKey> = {
  call: 'business.action.call',
  whatsapp: 'business.action.whatsapp',
  save: 'business.action.save',
  quote: 'business.action.quote',
  reservation: 'business.action.reservation',
  queue: 'business.action.queue',
  inquiry: 'business.action.inquiry',
  coupon: 'business.action.coupon',
  pricing: 'business.action.pricing',
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
  const { t } = useLocalization();
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
            label={t(labelKeys[action.capability])}
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
