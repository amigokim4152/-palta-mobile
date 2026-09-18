export const mockBusiness = {
  id: 'business-taller-1',
  name: 'Taller ejemplo',
  category: 'Mecánica',
  openState: 'Abierto',
  distance: '1,2 km',
  verificationStatus: 'unverified' as const,
  phone: '+56 9 0000 0000',
};

export const mockCare = {
  id: 'care-quote-1',
  intentKey: 'vehicle_repair_quote',
  state: 'wait' as const,
  waitingFor: 'Respuestas de talleres',
  expectedText: 'Esperando respuesta de 3 talleres',
};
