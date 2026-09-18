import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const actionBarPath = path.join(root, 'mobile-overlay/src/components/business/BusinessActionBar.tsx');
const reservationPath = path.join(root, 'mobile-overlay/src/features/business/BusinessReservationExperience.tsx');
const authRuntimePath = path.join(root, 'mobile-overlay/src/features/business/authenticatedBusinessRuntime.ts');
const ownerInboxPath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId]/reservations.tsx');
const ownerHomePath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId].tsx');
const carePath = path.join(root, 'mobile-overlay/src/app/care/[careTrackId].tsx');
const factoryPath = path.join(root, 'src/api/paltaApiFactory.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [
  actionBarPath,
  reservationPath,
  authRuntimePath,
  ownerInboxPath,
  ownerHomePath,
  carePath,
  factoryPath,
]) {
  assert(fs.existsSync(file), `Missing reservation source: ${path.relative(root, file)}`);
}

const actionBar = fs.readFileSync(actionBarPath, 'utf8');
const reservation = fs.readFileSync(reservationPath, 'utf8');
const authRuntime = fs.readFileSync(authRuntimePath, 'utf8');
const ownerInbox = fs.readFileSync(ownerInboxPath, 'utf8');
const ownerHome = fs.readFileSync(ownerHomePath, 'utf8');
const care = fs.readFileSync(carePath, 'utf8');
const factory = fs.readFileSync(factoryPath, 'utf8');

assert(
  actionBar.includes("capability === 'reservation'") &&
    actionBar.includes('/business/${encodeURIComponent(businessId)}/reservation'),
  'Reservation action must preserve canonical Business route.',
);
assert(
  actionBar.includes("capability === 'inquiry'") &&
    actionBar.includes('/messages/business/${encodeURIComponent(businessId)}'),
  'Inquiry must remain owned by Shared Messaging.',
);
assert(
  authRuntime.includes('getAuthenticatedMobileRuntime') &&
    authRuntime.includes('Local Business does not own Auth'),
  'Reservation surfaces must consume the runtime-composition-owned authenticated client instead of copying Auth.',
);
assert(
  reservation.includes('getBusinessAuthenticatedRuntime') &&
    reservation.includes('authenticatedRuntime.client.reservations.createReservation') &&
    !reservation.includes('mobileRuntime.client.reservations.createReservation') &&
    !reservation.includes('mobileRuntime.client.createCare'),
  'Reservation write must use authenticated runtime orchestration instead of anonymous runtime or direct Shared Care writes.',
);
assert(
  reservation.includes("channel: 'whatsapp'") &&
    reservation.includes('messagingContextType: preparedReservation.contextType') &&
    reservation.includes('Ya envié la solicitud'),
  'Reservation must keep explicit WhatsApp send confirmation and booking context.',
);
assert(
  ownerInbox.includes("business.verification_status !== 'verified'") &&
    ownerInbox.includes('getBusinessAuthenticatedRuntime') &&
    ownerInbox.includes('authenticatedRuntime.client.reservations.getBusinessInbox') &&
    ownerInbox.includes('authenticatedRuntime.client.reservations.respond') &&
    ownerInbox.includes("respond('confirmed')") &&
    ownerInbox.includes("respond('declined')"),
  'Reservation owner inbox must require authenticated runtime and support explicit confirm/decline decisions.',
);
assert(
  ownerHome.includes('pendingReservationCount') &&
    ownerHome.includes('getBusinessAuthenticatedRuntime') &&
    ownerHome.includes('authenticatedRuntime.client.reservations') &&
    ownerHome.includes('/reservations`') &&
    ownerHome.includes('solicitudes esperan') &&
    ownerHome.includes('tu confirmación'),
  'Verified owner home must load protected reservation work through authenticated runtime.',
);
assert(
  care.includes('getBusinessAuthenticatedRuntime') &&
    care.includes('authenticatedRuntime.client.getCare(careTrackId)') &&
    care.includes('authenticatedRuntime.client.reservations.getByCareTrack(careTrackId)') &&
    care.includes('reservationTitle(reservation)') &&
    care.includes('La solicitud fue enviada, pero todavía no es una reserva confirmada') &&
    !care.includes('mobileRuntime.client.getCare'),
  'Shared Care must read the authenticated canonical Care and reservation projection without creating a second workflow.',
);
assert(
  factory.includes('BusinessReservationsApiClient') && factory.includes('client.reservations ='),
  'Reservation API must be composed through the shared Palta client factory.',
);

console.log('PASS: Local Business authenticated reservation + verified owner response + Shared Care projection contract');
