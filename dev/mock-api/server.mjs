import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.PALTA_MOCK_HOST ?? '127.0.0.1';
const port = Number(process.env.PALTA_MOCK_PORT ?? '8787');

const businesses = [
  {
    id: 'biz-taller-1',
    name: 'Taller ejemplo',
    category_key: 'auto_repair',
    verification_status: 'unverified',
    opening_status: 'open',
    location: { lat: -33.3908, lng: -70.5707 },
    contact: { whatsapp: '+56000000000' },
  },
  {
    id: 'biz-farmacia-1',
    name: 'Farmacia ejemplo',
    category_key: 'pharmacy',
    verification_status: 'verified',
    opening_status: 'open',
    location: { lat: -33.3942, lng: -70.5752 },
    contact: { phone: '+56000000001' },
  },
];

const COMPLETE_HOME_DEMO_CAPABILITIES = [
  'context.locality',
  'context.notifications',
  'context.profile',
  'glance.weather',
  'glance.metro_status',
  'glance.bus_eta',
  'glance.air_quality',
  'glance.safety_status',
  'now.transport_arrival',
  'now.school_deadline',
  'now.payment_required',
  'now.quote_response',
  'now.important_message',
  'now.emergency_alert',
  'now.admin_deadline',
  'progress.care_request',
  'progress.order',
  'progress.municipal_application',
  'progress.community_membership',
  'progress.job_application',
  'progress.real_estate_inquiry',
  'progress.logistics_delivery',
  'progress.refund',
  'upcoming.health_appointment',
  'upcoming.school_event',
  'upcoming.community_event',
  'upcoming.vehicle_lifecycle',
  'upcoming.pet_lifecycle',
  'upcoming.job_interview',
  'upcoming.property_viewing',
  'upcoming.reservation',
  'upcoming.admin_renewal',
  'today.municipal_benefit',
  'today.community_notice',
  'today.local_news',
  'today.seasonal_food',
  'today.panorama',
  'today.followed_business_update',
  'today.local_service_change',
  'today.jobs_nearby',
  'today.property_saved_change',
];

const idempotencyCareIds = new Map();

const careTracks = new Map([
  ['care-demo-1', {
    id: 'care-demo-1',
    intent_key: 'local_business_quote',
    state: 'wait',
    waiting_for: 'business_response',
    expected_at: '2026-09-17T18:00:00-03:00',
  }],
]);

const profileState = {
  preferred_language: 'es-CL',
  timezone: 'America/Santiago',
  country_code: 'CL',
};

const notificationItems = [
  {
    id: 'notification-care-demo-1',
    title: 'Tu solicitud sigue en curso',
    body: 'Puedes revisar el seguimiento del taller desde aquí.',
    source_domain: 'care',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    importance: 'important',
    target: '/care/care-demo-1',
  },
  {
    id: 'notification-local-demo-1',
    title: 'Información importante para tu zona',
    body: 'Palta puede avisarte cuando una novedad local requiera atención.',
    source_domain: 'public-life',
    created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    importance: 'normal',
    target: '/context/location',
  },
];

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isoAfter(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function dateAtOffset(days, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizePreferredName(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

function buildNotificationResponse() {
  const unread = notificationItems.filter((item) => !item.read_at);
  const importantUnread = unread.filter((item) => item.importance === 'important');
  const urgentUnread = unread.filter((item) => item.importance === 'urgent');
  const latestUnreadAt = unread
    .map((item) => item.created_at)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    items: [...notificationItems].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    ),
    summary: {
      unread_count: unread.length,
      important_unread_count: importantUnread.length,
      urgent_unread_count: urgentUnread.length,
      ...(latestUnreadAt ? { latest_unread_at: latestUnreadAt } : {}),
    },
  };
}

function demoItem(input) {
  return {
    delivery: 'home',
    data_mode: 'demo',
    personalized: true,
    corrections: ['not_relevant', 'already_done', 'incorrect_information'],
    urgency: 0,
    importance: 2,
    relevance: 0.75,
    ...input,
  };
}

function buildFunctionalHomeMock() {
  const observedAt = new Date().toISOString();
  const weatherExpiresAt = isoAfter(30 * 60 * 1000);
  const mobilityExpiresAt = isoAfter(2 * 60 * 1000);
  const sameDayExpiresAt = isoAfter(8 * 60 * 60 * 1000);
  const notificationSummary = buildNotificationResponse().summary;

  return {
    contract_version: 'functional-home-v1',
    generated_at: observedAt,
    locality_label: 'Vitacura',
    demo_mode: true,
    demo_label: 'Vista de demostración · datos de ejemplo',
    demo_capability_keys: COMPLETE_HOME_DEMO_CAPABILITIES,
    context: {
      locality: {
        id: 'vitacura',
        label: 'Vitacura',
        change_target: '/context/location',
      },
      notifications_target: '/activity/notifications',
      unread_notification_count: notificationSummary.unread_count,
      profile_target: '/context/profile',
    },
    glance: [
      {
        id: 'weather-vitacura',
        capability_key: 'glance.weather',
        label: 'CLIMA',
        value: '18°',
        detail: 'Despejado',
        source_domain: 'weather',
        data_mode: 'demo',
        observed_at: observedAt,
        expires_at: weatherExpiresAt,
        relevance: 0.82,
      },
      {
        id: 'metro-l1',
        capability_key: 'glance.metro_status',
        label: 'METRO L1',
        value: 'Normal',
        detail: 'Sin incidencias',
        source_domain: 'mobility',
        data_mode: 'demo',
        observed_at: observedAt,
        expires_at: mobilityExpiresAt,
        relevance: 0.8,
      },
      {
        id: 'bus-405',
        capability_key: 'glance.bus_eta',
        label: 'BUS 405',
        value: '6 min',
        detail: 'Parada habitual',
        source_domain: 'mobility',
        data_mode: 'demo',
        observed_at: observedAt,
        expires_at: mobilityExpiresAt,
        relevance: 0.9,
      },
      {
        id: 'air-vitacura',
        capability_key: 'glance.air_quality',
        label: 'AIRE',
        value: 'Bueno',
        detail: 'Actividad normal',
        source_domain: 'public-life',
        data_mode: 'demo',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        relevance: 0.62,
      },
      {
        id: 'safety-vitacura',
        capability_key: 'glance.safety_status',
        label: 'SEGURIDAD',
        value: 'Sin alertas',
        detail: 'Estado local',
        source_domain: 'safety',
        data_mode: 'demo',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        relevance: 0.58,
      },
    ],
    items: [
      demoItem({
        id: 'home-bus-demo-1',
        capability_key: 'now.transport_arrival',
        kind: 'alert',
        title: 'Tu bus 405 está por llegar',
        body: 'Llegada estimada en 6 min en tu parada habitual.',
        source_domain: 'mobility',
        surface: 'now',
        observed_at: observedAt,
        expires_at: mobilityExpiresAt,
        dedupe_key: 'mobility:bus:405:habitual-stop',
        subject: { kind: 'place', id: 'demo-stop-home', label: 'Parada habitual' },
        corrections: ['not_relevant', 'incorrect_information', 'hide_type'],
        urgency: 3,
        relevance: 0.96,
      }),
      demoItem({
        id: 'home-school-deadline-demo-1',
        capability_key: 'now.school_deadline',
        kind: 'alert',
        title: 'Hoy vence un documento del colegio',
        body: 'Revisa el formulario antes del final del día.',
        source_domain: 'school',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'school:document:demo-deadline',
        subject: { kind: 'person', id: 'demo-child', label: 'Hija' },
        corrections: ['wrong_subject', 'already_done', 'incorrect_information'],
        urgency: 3,
        importance: 3,
        relevance: 0.94,
      }),
      demoItem({
        id: 'home-payment-demo-1',
        capability_key: 'now.payment_required',
        kind: 'alert',
        title: 'Hay un pago pendiente',
        body: 'Un pedido necesita confirmar el pago para continuar.',
        source_domain: 'commerce',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'commerce:payment:demo-1',
        subject: { kind: 'other', id: 'demo-order-payment', label: 'Pedido' },
        urgency: 2,
        relevance: 0.9,
      }),
      demoItem({
        id: 'home-quote-response-demo-1',
        capability_key: 'now.quote_response',
        kind: 'alert',
        title: 'Llegó una respuesta a tu cotización',
        body: 'El taller respondió y puedes decidir el siguiente paso.',
        source_domain: 'local-business',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'local-business:quote-response:demo-1',
        subject: { kind: 'vehicle', id: 'demo-car', label: 'Auto familiar' },
        urgency: 2,
        importance: 3,
        relevance: 0.92,
      }),
      demoItem({
        id: 'home-message-demo-1',
        capability_key: 'now.important_message',
        kind: 'alert',
        title: 'Tienes un mensaje importante',
        body: 'Una conversación relacionada con un trámite requiere tu atención.',
        source_domain: 'message',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'message:important:demo-1',
        subject: { kind: 'other', id: 'demo-conversation', label: 'Mensaje' },
        urgency: 2,
        relevance: 0.88,
      }),
      demoItem({
        id: 'home-emergency-demo-1',
        capability_key: 'now.emergency_alert',
        kind: 'alert',
        title: 'Alerta local de ejemplo',
        body: 'Las alertas verificadas de seguridad o emergencia aparecerán aquí cuando correspondan.',
        source_domain: 'safety',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'safety:alert:demo-1',
        subject: { kind: 'place', id: 'vitacura', label: 'Vitacura' },
        corrections: ['incorrect_information'],
        urgency: 4,
        importance: 4,
        relevance: 1,
      }),
      demoItem({
        id: 'home-admin-deadline-demo-1',
        capability_key: 'now.admin_deadline',
        kind: 'alert',
        title: 'Un trámite vence pronto',
        body: 'Palta puede reunir aquí renovaciones y plazos administrativos relevantes.',
        source_domain: 'public-life',
        surface: 'now',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'public-life:deadline:demo-1',
        subject: { kind: 'household', id: 'demo-household', label: 'Hogar' },
        urgency: 2,
        relevance: 0.84,
      }),

      demoItem({
        id: 'home-care-demo-1',
        capability_key: 'progress.care_request',
        kind: 'status',
        title: 'Esperando respuesta del taller',
        body: 'Tu solicitud de cotización sigue en curso.',
        source_domain: 'care',
        care_track_id: 'care-demo-1',
        surface: 'in_progress',
        observed_at: observedAt,
        action_label: 'Ver seguimiento',
        action_target: '/care/care-demo-1',
        action_kind: 'internal',
        dedupe_key: 'care:care-demo-1',
        subject: { kind: 'vehicle', id: 'demo-car', label: 'Auto familiar' },
        corrections: ['wrong_subject', 'already_done', 'incorrect_information'],
        urgency: 1,
        importance: 3,
        relevance: 0.95,
      }),
      demoItem({
        id: 'home-order-demo-1',
        capability_key: 'progress.order',
        kind: 'status',
        title: 'Tu pedido está en preparación',
        body: 'El comercio ya confirmó el pedido y lo está preparando.',
        source_domain: 'commerce',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'commerce:order:demo-1',
        subject: { kind: 'other', id: 'demo-order-1', label: 'Pedido' },
        relevance: 0.82,
      }),
      demoItem({
        id: 'home-benefit-application-demo-1',
        capability_key: 'progress.municipal_application',
        kind: 'status',
        title: 'Solicitud municipal en revisión',
        body: 'La postulación fue recibida y está siendo revisada.',
        source_domain: 'public-life',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'public-life:application:demo-1',
        subject: { kind: 'household', id: 'demo-household', label: 'Hogar' },
        relevance: 0.78,
      }),
      demoItem({
        id: 'home-community-membership-demo-1',
        capability_key: 'progress.community_membership',
        kind: 'status',
        title: 'Ingreso al grupo del colegio pendiente',
        body: 'La solicitud de acceso está esperando aprobación.',
        source_domain: 'community',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'community:membership:demo-school',
        subject: { kind: 'person', id: 'demo-child', label: 'Hija' },
        relevance: 0.75,
      }),
      demoItem({
        id: 'home-job-application-demo-1',
        capability_key: 'progress.job_application',
        kind: 'status',
        title: 'Postulación de trabajo enviada',
        body: 'La empresa recibió tu postulación y está pendiente de revisión.',
        source_domain: 'jobs',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'jobs:application:demo-1',
        subject: { kind: 'person', id: 'demo-self', label: 'Tú' },
        relevance: 0.76,
      }),
      demoItem({
        id: 'home-property-inquiry-demo-1',
        capability_key: 'progress.real_estate_inquiry',
        kind: 'status',
        title: 'Consulta por una propiedad enviada',
        body: 'Estás esperando respuesta sobre una propiedad guardada.',
        source_domain: 'real-estate',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'real-estate:inquiry:demo-1',
        subject: { kind: 'place', id: 'demo-property', label: 'Propiedad guardada' },
        relevance: 0.72,
      }),
      demoItem({
        id: 'home-logistics-demo-1',
        capability_key: 'progress.logistics_delivery',
        kind: 'status',
        title: 'Envío en camino',
        body: 'El estado físico del despacho aparecerá separado del estado del pedido.',
        source_domain: 'logistics',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'logistics:shipment:demo-1',
        subject: { kind: 'other', id: 'demo-shipment', label: 'Envío' },
        relevance: 0.79,
      }),
      demoItem({
        id: 'home-refund-demo-1',
        capability_key: 'progress.refund',
        kind: 'status',
        title: 'Reembolso en proceso',
        body: 'Palta mostrará el estado confirmado del reembolso hasta su cierre.',
        source_domain: 'commerce',
        surface: 'in_progress',
        observed_at: observedAt,
        dedupe_key: 'commerce:refund:demo-1',
        subject: { kind: 'other', id: 'demo-refund', label: 'Reembolso' },
        relevance: 0.74,
      }),

      demoItem({
        id: 'home-health-demo-1',
        capability_key: 'upcoming.health_appointment',
        kind: 'status',
        title: 'Consulta médica',
        body: 'Revisa los documentos que debes llevar.',
        source_domain: 'health',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(1, 10, 30),
        observed_at: observedAt,
        dedupe_key: 'health:appointment:demo-1',
        subject: { kind: 'person', id: 'demo-self', label: 'Tú' },
        urgency: 1,
        importance: 3,
        relevance: 0.88,
      }),
      demoItem({
        id: 'home-school-event-demo-1',
        capability_key: 'upcoming.school_event',
        kind: 'status',
        title: 'Actividad del colegio',
        body: 'Hay una actividad confirmada para la mañana.',
        source_domain: 'school',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(2, 8, 0),
        observed_at: observedAt,
        dedupe_key: 'school:event:demo-1',
        subject: { kind: 'person', id: 'demo-child', label: 'Hija' },
        relevance: 0.86,
      }),
      demoItem({
        id: 'home-community-event-demo-1',
        capability_key: 'upcoming.community_event',
        kind: 'status',
        title: 'Encuentro de la comunidad',
        body: 'Reunión confirmada del grupo al que perteneces.',
        source_domain: 'community',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(3, 11, 0),
        observed_at: observedAt,
        dedupe_key: 'community:event:demo-1',
        subject: { kind: 'other', id: 'demo-community', label: 'Comunidad' },
        relevance: 0.72,
      }),
      demoItem({
        id: 'home-vehicle-demo-1',
        capability_key: 'upcoming.vehicle_lifecycle',
        kind: 'status',
        title: 'Revisión técnica del auto',
        body: 'Conviene revisar documentos y reservar tiempo antes de la fecha.',
        source_domain: 'vehicle',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(12, 9, 0),
        observed_at: observedAt,
        dedupe_key: 'vehicle:inspection:demo-car',
        subject: { kind: 'vehicle', id: 'demo-car', label: 'Auto familiar' },
        importance: 3,
        relevance: 0.84,
      }),
      demoItem({
        id: 'home-pet-demo-1',
        capability_key: 'upcoming.pet_lifecycle',
        kind: 'status',
        title: 'Vacuna de tu mascota',
        body: 'La próxima vacuna está registrada para este mes.',
        source_domain: 'pets',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(21, 17, 30),
        observed_at: observedAt,
        dedupe_key: 'pets:vaccine:demo-pet',
        subject: { kind: 'pet', id: 'demo-pet', label: 'Mascota' },
        relevance: 0.74,
      }),
      demoItem({
        id: 'home-job-interview-demo-1',
        capability_key: 'upcoming.job_interview',
        kind: 'status',
        title: 'Entrevista de trabajo',
        body: 'Entrevista confirmada para una postulación que sigues en Palta.',
        source_domain: 'jobs',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(4, 15, 0),
        observed_at: observedAt,
        dedupe_key: 'jobs:interview:demo-1',
        subject: { kind: 'person', id: 'demo-self', label: 'Tú' },
        relevance: 0.81,
      }),
      demoItem({
        id: 'home-property-viewing-demo-1',
        capability_key: 'upcoming.property_viewing',
        kind: 'status',
        title: 'Visita a una propiedad',
        body: 'Tienes una visita confirmada a una propiedad guardada.',
        source_domain: 'real-estate',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(5, 12, 0),
        observed_at: observedAt,
        dedupe_key: 'real-estate:viewing:demo-1',
        subject: { kind: 'place', id: 'demo-property', label: 'Propiedad guardada' },
        relevance: 0.78,
      }),
      demoItem({
        id: 'home-reservation-demo-1',
        capability_key: 'upcoming.reservation',
        kind: 'status',
        title: 'Reserva confirmada',
        body: 'Una reserva o cita confirmada puede aparecer aquí con su preparación.',
        source_domain: 'care',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(6, 19, 0),
        observed_at: observedAt,
        dedupe_key: 'care:reservation:demo-1',
        subject: { kind: 'person', id: 'demo-self', label: 'Tú' },
        relevance: 0.73,
      }),
      demoItem({
        id: 'home-admin-renewal-demo-1',
        capability_key: 'upcoming.admin_renewal',
        kind: 'status',
        title: 'Renovación administrativa',
        body: 'Una renovación futura se mantiene visible antes de convertirse en urgente.',
        source_domain: 'public-life',
        surface: 'upcoming',
        scheduled_at: dateAtOffset(30, 9, 0),
        observed_at: observedAt,
        dedupe_key: 'public-life:renewal:demo-1',
        subject: { kind: 'household', id: 'demo-household', label: 'Hogar' },
        relevance: 0.68,
      }),

      demoItem({
        id: 'home-public-benefit-demo-1',
        capability_key: 'today.municipal_benefit',
        kind: 'useful_today',
        title: 'Beneficio municipal que podrías revisar',
        body: 'Palta mostrará aquí beneficios vigentes cuando coincidan con tu comuna y situación.',
        source_domain: 'public-life',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'public-life:benefit:demo-1',
        subject: { kind: 'household', id: 'demo-household', label: 'Hogar' },
        corrections: ['not_relevant', 'incorrect_information', 'hide_type'],
        relevance: 0.82,
      }),
      demoItem({
        id: 'home-community-notice-demo-1',
        capability_key: 'today.community_notice',
        kind: 'useful_today',
        title: 'Aviso importante del colegio',
        body: 'Una comunicación fijada del grupo escolar aparece aquí porque te corresponde.',
        source_domain: 'community',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'community:announcement:demo-1',
        subject: { kind: 'person', id: 'demo-child', label: 'Hija' },
        relevance: 0.8,
      }),
      demoItem({
        id: 'home-news-demo-1',
        capability_key: 'today.local_news',
        kind: 'content',
        title: 'Cambio local que conviene conocer',
        body: 'Resumen breve de una noticia reciente y relevante para Vitacura.',
        source_domain: 'news',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'news:vitacura:demo-1',
        personalized: false,
        corrections: undefined,
        importance: 1,
        relevance: 0.72,
      }),
      demoItem({
        id: 'home-seasonal-demo-1',
        capability_key: 'today.seasonal_food',
        kind: 'content',
        title: 'De temporada esta semana',
        body: 'Frutas, verduras o pescados de temporada que vale la pena considerar.',
        source_domain: 'local-life',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'local-life:seasonal:demo-1',
        personalized: false,
        corrections: undefined,
        importance: 1,
        relevance: 0.64,
      }),
      demoItem({
        id: 'home-play-demo-1',
        capability_key: 'today.panorama',
        kind: 'content',
        title: 'Panorama cercano para el fin de semana',
        body: 'Una actividad cultural o familiar cercana puede aparecer cuando Home esté tranquilo.',
        source_domain: 'play',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'play:weekend:demo-1',
        personalized: false,
        corrections: undefined,
        importance: 1,
        relevance: 0.6,
      }),
      demoItem({
        id: 'home-followed-business-demo-1',
        capability_key: 'today.followed_business_update',
        kind: 'useful_today',
        title: 'Novedad de un negocio que sigues',
        body: 'Un cambio útil de horario, servicio o disponibilidad puede aparecer sin convertirse en publicidad genérica.',
        source_domain: 'local-business',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'local-business:followed:update:demo-1',
        subject: { kind: 'business', id: 'biz-taller-1', label: 'Taller ejemplo' },
        relevance: 0.69,
      }),
      demoItem({
        id: 'home-local-service-change-demo-1',
        capability_key: 'today.local_service_change',
        kind: 'useful_today',
        title: 'Cambio en un servicio de tu comuna',
        body: 'Aseo, tránsito, horarios municipales u otros cambios operativos relevantes aparecerán aquí.',
        source_domain: 'public-life',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'public-life:service-change:demo-1',
        subject: { kind: 'place', id: 'vitacura', label: 'Vitacura' },
        relevance: 0.76,
      }),
      demoItem({
        id: 'home-nearby-job-demo-1',
        capability_key: 'today.jobs_nearby',
        kind: 'content',
        title: 'Trabajo cercano que coincide contigo',
        body: 'Una oportunidad muy relevante por distancia y condiciones puede aparecer cuando Home esté tranquilo.',
        source_domain: 'jobs',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'jobs:nearby:demo-1',
        subject: { kind: 'person', id: 'demo-self', label: 'Tú' },
        relevance: 0.66,
      }),
      demoItem({
        id: 'home-saved-property-change-demo-1',
        capability_key: 'today.property_saved_change',
        kind: 'useful_today',
        title: 'Cambió una propiedad que guardaste',
        body: 'Una baja de precio o cambio importante en una propiedad guardada puede aparecer aquí.',
        source_domain: 'real-estate',
        surface: 'useful_today',
        observed_at: observedAt,
        expires_at: sameDayExpiresAt,
        dedupe_key: 'real-estate:saved-change:demo-1',
        subject: { kind: 'place', id: 'demo-property', label: 'Propiedad guardada' },
        relevance: 0.7,
      }),
    ],
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    if (req.method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'palta-mock-api', version: '0.6.0' });
    }

    if (req.method === 'GET' && url.pathname === '/v1/home') {
      return json(res, 200, buildFunctionalHomeMock());
    }

    if (req.method === 'GET' && url.pathname === '/v1/profile') {
      return json(res, 200, profileState);
    }

    if (req.method === 'PATCH' && url.pathname === '/v1/profile') {
      const body = await readJson(req);
      if (Object.prototype.hasOwnProperty.call(body, 'preferred_name')) {
        const preferredName = normalizePreferredName(body.preferred_name);
        if (preferredName === null) {
          return json(res, 400, { error: 'preferred_name_must_be_string_or_null' });
        }
        if (preferredName) profileState.preferred_name = preferredName;
        else delete profileState.preferred_name;
      }
      return json(res, 200, profileState);
    }

    if (req.method === 'GET' && url.pathname === '/v1/notifications') {
      return json(res, 200, buildNotificationResponse());
    }

    const notificationReadMatch = url.pathname.match(
      /^\/v1\/notifications\/([^/]+)\/read$/,
    );
    if (req.method === 'POST' && notificationReadMatch) {
      const id = decodeURIComponent(notificationReadMatch[1]);
      const item = notificationItems.find((candidate) => candidate.id === id);
      if (!item) return json(res, 404, { error: 'notification_not_found' });
      if (!item.read_at) item.read_at = new Date().toISOString();
      return json(res, 200, item);
    }

    if (req.method === 'GET' && url.pathname === '/v1/local/search') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { error: 'lat_lng_required' });
      }
      return json(res, 200, {
        items: businesses.map((business, index) => ({
          entity_id: business.id,
          entity_type: 'business',
          name: business.name,
          category_key: business.category_key,
          verification_status: business.verification_status,
          distance_m: index === 0 ? 1200 : 850,
          location: business.location,
        })),
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/business/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/business/'.length));
      const business = businesses.find((item) => item.id === id);
      return business
        ? json(res, 200, business)
        : json(res, 404, { error: 'business_not_found' });
    }

    if (req.method === 'POST' && url.pathname === '/v1/care') {
      const body = await readJson(req);
      if (typeof body.intent_key !== 'string' || !body.intent_key) {
        return json(res, 400, { error: 'intent_key_required' });
      }

      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey === 'string') {
        const existingId = idempotencyCareIds.get(idempotencyKey);
        const existing = existingId ? careTracks.get(existingId) : undefined;
        if (existing) return json(res, 200, existing);
      }

      const id = `care-${randomUUID()}`;
      const care = {
        id,
        intent_key: body.intent_key,
        state: 'wait',
        waiting_for: 'business_response',
        expected_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      careTracks.set(id, care);

      if (typeof idempotencyKey === 'string') idempotencyCareIds.set(idempotencyKey, id);
      return json(res, 201, care);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/care/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/care/'.length));
      const care = careTracks.get(id);
      return care
        ? json(res, 200, care)
        : json(res, 404, { error: 'care_not_found' });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'internal_error' });
  }
});

server.listen(port, host, () => {
  console.log(`Palta mock API listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
