export type VehicleCaptureSlotId =
  | 'front_three_quarter'
  | 'rear_three_quarter'
  | 'driver_side'
  | 'interior'
  | 'odometer'
  | 'damage_optional';

export type VehicleCaptureSlot = {
  id: VehicleCaptureSlotId;
  title: string;
  guidance: string;
  required: boolean;
};

export const AUTOS_CAPTURE_SLOTS: readonly VehicleCaptureSlot[] = [
  {
    id: 'front_three_quarter',
    title: 'Frente del auto',
    guidance: 'Incluye el auto completo y deja espacio alrededor.',
    required: true,
  },
  {
    id: 'rear_three_quarter',
    title: 'Parte trasera',
    guidance: 'Incluye el auto completo y evita contraluz fuerte.',
    required: true,
  },
  {
    id: 'driver_side',
    title: 'Costado',
    guidance: 'Toma el lateral completo, sin cortar ruedas ni parachoques.',
    required: true,
  },
  {
    id: 'interior',
    title: 'Interior',
    guidance: 'Muestra tablero, volante y asientos delanteros.',
    required: true,
  },
  {
    id: 'odometer',
    title: 'Kilometraje',
    guidance: 'Enciende el tablero y acerca la cámara al kilometraje.',
    required: true,
  },
  {
    id: 'damage_optional',
    title: 'Detalles o daños',
    guidance: 'Si hay rayas, golpes o detalles, muéstralos de cerca.',
    required: false,
  },
] as const;

export type VehicleRecognitionProvider =
  | 'manual'
  | 'device_ocr'
  | 'partner_registry'
  | 'paid_ai';

export type VehicleRecognitionCapability =
  | 'plate_text'
  | 'odometer_text'
  | 'vehicle_identity'
  | 'damage_candidates';

export type VehicleRecognitionPolicy = {
  activeProviders: readonly VehicleRecognitionProvider[];
  enabledCapabilities: readonly VehicleRecognitionCapability[];
  paidAiEnabled: boolean;
};

/**
 * Initial launch policy: the selling flow must work without paid AI.
 * Paid/image recognition can be enabled later without changing the UX contract.
 */
export const INITIAL_AUTOS_RECOGNITION_POLICY: VehicleRecognitionPolicy = {
  activeProviders: ['manual'],
  enabledCapabilities: [],
  paidAiEnabled: false,
};

export function hasRequiredVehicleCaptures(
  capturedSlots: readonly VehicleCaptureSlotId[],
): boolean {
  const captured = new Set(capturedSlots);
  return AUTOS_CAPTURE_SLOTS.every((slot) => !slot.required || captured.has(slot.id));
}
