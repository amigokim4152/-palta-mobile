export type POSFormFactor = 'phone' | 'tablet' | 'desktop' | 'dedicated_pos';
export type POSPlatform = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'web';
export type POSViewportClass = 'compact' | 'medium' | 'wide';

export type POSPeripheralCapability =
  | 'barcode_scanner'
  | 'receipt_printer'
  | 'cash_drawer'
  | 'customer_display'
  | 'scale'
  | 'payment_terminal'
  | 'camera'
  | 'nfc_tap_to_pay';

export type POSDeviceProfile = {
  formFactor: POSFormFactor;
  platform: POSPlatform;
  viewportWidthCssPx: number;
  touch: boolean;
  keyboard: boolean;
  pointer: boolean;
  capabilities: ReadonlySet<POSPeripheralCapability>;
};

export type POSSurfaceMode = 'mobile_quick' | 'touch_register' | 'desktop_register';
export type POSLayout = 'single_column' | 'catalog_cart_split' | 'workspace_split';
export type POSNavigation = 'bottom_actions' | 'side_rail' | 'sidebar';
export type POSContentDensity = 'comfortable' | 'compact';

export type POSFeature =
  | 'quick_sale'
  | 'catalog_search'
  | 'cart'
  | 'payment'
  | 'fiscal_status'
  | 'receipt_share'
  | 'customer_lookup'
  | 'refund_exchange'
  | 'cash_session'
  | 'inventory_lookup'
  | 'operational_history'
  | 'backoffice';

export type POSSurfaceDecision = {
  viewportClass: POSViewportClass;
  mode: POSSurfaceMode;
  layout: POSLayout;
  navigation: POSNavigation;
  density: POSContentDensity;
  minimumTouchTargetPx: number;
  cartPinned: boolean;
  preferKeyboardShortcuts: boolean;
  showPersistentPeripheralStatus: boolean;
  primaryFeatures: readonly POSFeature[];
  secondaryFeatures: readonly POSFeature[];
};

export function classifyPOSViewport(widthCssPx: number): POSViewportClass {
  if (!Number.isFinite(widthCssPx) || widthCssPx <= 0) {
    throw new Error('viewportWidthCssPx must be a positive finite number.');
  }
  if (widthCssPx < 600) return 'compact';
  if (widthCssPx < 1024) return 'medium';
  return 'wide';
}

/**
 * Presentation policy only. Authorization must remain role/policy based and must
 * never be inferred from screen size, OS, form factor, or attached peripherals.
 */
export function decidePOSSurface(device: POSDeviceProfile): POSSurfaceDecision {
  const viewportClass = classifyPOSViewport(device.viewportWidthCssPx);

  if (device.formFactor === 'phone') {
    return {
      viewportClass,
      mode: 'mobile_quick',
      layout: 'single_column',
      navigation: 'bottom_actions',
      density: 'comfortable',
      minimumTouchTargetPx: 48,
      cartPinned: false,
      preferKeyboardShortcuts: false,
      showPersistentPeripheralStatus: false,
      primaryFeatures: [
        'quick_sale',
        'payment',
        'fiscal_status',
        'receipt_share',
        'operational_history',
      ],
      secondaryFeatures: [
        'catalog_search',
        'cart',
        'customer_lookup',
        'refund_exchange',
        'cash_session',
        'inventory_lookup',
        'backoffice',
      ],
    };
  }

  if (device.formFactor === 'desktop') {
    return {
      viewportClass,
      mode: 'desktop_register',
      layout: viewportClass === 'wide' ? 'workspace_split' : 'catalog_cart_split',
      navigation: 'sidebar',
      density: 'compact',
      minimumTouchTargetPx: device.touch ? 44 : 36,
      cartPinned: true,
      preferKeyboardShortcuts: device.keyboard,
      showPersistentPeripheralStatus: device.capabilities.size > 0,
      primaryFeatures: [
        'catalog_search',
        'cart',
        'payment',
        'customer_lookup',
        'refund_exchange',
        'cash_session',
        'inventory_lookup',
        'operational_history',
        'fiscal_status',
        'backoffice',
      ],
      secondaryFeatures: ['quick_sale', 'receipt_share'],
    };
  }

  const dedicated = device.formFactor === 'dedicated_pos';
  return {
    viewportClass,
    mode: 'touch_register',
    layout: viewportClass === 'compact' ? 'single_column' : 'catalog_cart_split',
    navigation: viewportClass === 'wide' ? 'side_rail' : 'bottom_actions',
    density: viewportClass === 'compact' ? 'comfortable' : 'compact',
    minimumTouchTargetPx: 48,
    cartPinned: viewportClass !== 'compact',
    preferKeyboardShortcuts: device.keyboard,
    showPersistentPeripheralStatus: dedicated || device.capabilities.size > 0,
    primaryFeatures: [
      'catalog_search',
      'cart',
      'payment',
      'fiscal_status',
      'customer_lookup',
      'refund_exchange',
      'cash_session',
      'inventory_lookup',
    ],
    secondaryFeatures: ['quick_sale', 'receipt_share', 'operational_history', 'backoffice'],
  };
}

export type POSPeripheralPresentation = {
  capability: POSPeripheralCapability;
  prominent: boolean;
};

/**
 * Peripherals remain adapters. Their presence changes the UI affordance, not the
 * canonical sale/payment/fiscal workflow.
 */
export function decidePeripheralPresentation(
  device: POSDeviceProfile,
): POSPeripheralPresentation[] {
  const registerSurface = device.formFactor === 'tablet' || device.formFactor === 'dedicated_pos';
  return [...device.capabilities].map((capability) => ({
    capability,
    prominent:
      registerSurface &&
      (capability === 'barcode_scanner' ||
        capability === 'receipt_printer' ||
        capability === 'cash_drawer' ||
        capability === 'payment_terminal'),
  }));
}
