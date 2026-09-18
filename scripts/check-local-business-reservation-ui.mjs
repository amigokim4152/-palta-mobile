import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const actionBarPath = path.join(root, 'mobile-overlay/src/components/business/BusinessActionBar.tsx');
const reservationPath = path.join(root, 'mobile-overlay/src/features/business/BusinessReservationExperience.tsx');
const ownerInboxPath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId]/reservations.tsx');
const ownerHomePath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId].tsx');
const factoryPath = path.join(root, 'src/api/paltaApiFactory.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [actionBarPath, reservationPath, ownerInboxPath, ownerHomePath, factoryPath]) {
  assert(fs.existsSync(file), `Missing reservation source: ${path.relative(root, file)}`);
}

const actionBar = fs.readFileSync(actionBarPath, 'utf8');
const reservation = fs.readFileSync(reservationPath, 'utf8');
const ownerInbox = fs.readFileSync(ownerInboxPath, 'utf8');
const ownerHome = fs.readFileSync(ownerHomePath, 'utf8');
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
  reservation.includes('mobileRuntime.client.reservations.createReservation') &&
    !reservation.includes('mobileRuntime.client.createCare'),
  'Reservation UI must create one reservation orchestration instead of authoring Shared Care directly.',
);
assert(
  reservation.includes("channel: 'whatsapp'") &&
    reservation.includes('messagingContextType: preparedReservation.contextType') &&
    reservation.includes('Ya envié la solicitud'),
  'Reservation must keep explicit WhatsApp send confirmation and booking context.',
);
assert(
  ownerInbox.includes("business.verification_status !== 'verified'") &&
    ownerInbox.includes('mobileRuntime.client.reservations.getBusinessInbox') &&
    ownerInbox.includes("respond('confirmed')") &&
    ownerInbox.includes("respond('declined')"),
  'Reservation owner inbox must be verified-only and support explicit confirm/decline decisions.',
);
assert(
  ownerHome.includes('pendingReservationCount') &&
    ownerHome.includes('mobileRuntime.client.reservations') &&
    ownerHome.includes('/reservations`') &&
    ownerHome.includes('solicitudes esperan') &&
    ownerHome.includes('tu confirmación'),
  'Verified owner home must surface reservation requests that need a real business decision.',
);
assert(
  factory.includes('BusinessReservationsApiClient') && factory.includes('client.reservations ='),
  'Reservation API must be composed through the shared Palta client factory.',
);

console.log('PASS: Local Business reservation request + verified owner response + Shared Care UI contract');
