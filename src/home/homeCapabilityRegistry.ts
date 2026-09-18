export type HomeCapabilitySurface = 'context' | 'glance' | 'now' | 'in_progress' | 'upcoming' | 'useful_today';

export type HomeCapabilityStatus =
  | 'connected'
  | 'adapter_ready'
  | 'primitive_ready'
  | 'demo_only'
  | 'pending_core';

export type HomeCapabilityDefinition = {
  key: string;
  surface: HomeCapabilitySurface;
  ownerCore: string;
  status: HomeCapabilityStatus;
  demoRequired: boolean;
  description: string;
};

/**
 * Product-level capability registry for Personal Home.
 *
 * This is intentionally independent of visual layout. It answers only:
 * "What must Palta Home be able to represent?"
 *
 * A production user will normally see only a small relevant subset. The
 * complete development demo covers the registry so product gaps are visible
 * before every live source exists.
 */
export const HOME_CAPABILITIES: readonly HomeCapabilityDefinition[] = [
  { key: 'context.locality', surface: 'context', ownerCore: 'Location', status: 'connected', demoRequired: true, description: 'Effective locality and correction/change entry.' },
  { key: 'context.notifications', surface: 'context', ownerCore: 'Notification', status: 'connected', demoRequired: true, description: 'Unread notification inbox entry and count.' },
  { key: 'context.profile', surface: 'context', ownerCore: 'Auth/Profile', status: 'connected', demoRequired: true, description: 'Minimal profile/account entry.' },

  { key: 'glance.weather', surface: 'glance', ownerCore: 'Weather', status: 'adapter_ready', demoRequired: true, description: 'Compact current weather.' },
  { key: 'glance.precipitation', surface: 'glance', ownerCore: 'Weather', status: 'adapter_ready', demoRequired: true, description: 'Near-term precipitation or rain probability.' },
  { key: 'glance.uv', surface: 'glance', ownerCore: 'Weather', status: 'adapter_ready', demoRequired: true, description: 'Current/maximum UV context.' },
  { key: 'glance.metro_status', surface: 'glance', ownerCore: 'Mobility', status: 'adapter_ready', demoRequired: true, description: 'Relevant Metro operating status.' },
  { key: 'glance.bus_eta', surface: 'glance', ownerCore: 'Mobility/DTPM', status: 'adapter_ready', demoRequired: true, description: 'Verified realtime ETA for a relevant stop.' },
  { key: 'glance.air_quality', surface: 'glance', ownerCore: 'Environment/Public-Life', status: 'demo_only', demoRequired: true, description: 'Locally meaningful air-quality signal.' },
  { key: 'glance.safety_status', surface: 'glance', ownerCore: 'Safety/Event', status: 'pending_core', demoRequired: true, description: 'Compact normal/exceptional local safety or emergency state.' },

  { key: 'now.transport_arrival', surface: 'now', ownerCore: 'Mobility', status: 'adapter_ready', demoRequired: true, description: 'Relevant vehicle arriving soon.' },
  { key: 'now.school_deadline', surface: 'now', ownerCore: 'School', status: 'primitive_ready', demoRequired: true, description: 'School document, preparation, or deadline requiring action.' },
  { key: 'now.payment_required', surface: 'now', ownerCore: 'Commerce/Payment', status: 'adapter_ready', demoRequired: true, description: 'Payment or checkout action required.' },
  { key: 'now.quote_response', surface: 'now', ownerCore: 'Local Business/Care', status: 'adapter_ready', demoRequired: true, description: 'Quote or service response requiring a decision.' },
  { key: 'now.important_message', surface: 'now', ownerCore: 'Message', status: 'pending_core', demoRequired: true, description: 'Important direct message requiring user attention.' },
  { key: 'now.emergency_alert', surface: 'now', ownerCore: 'Safety/Event', status: 'adapter_ready', demoRequired: true, description: 'Verified emergency/disaster alert affecting the user.' },
  { key: 'now.weather_hazard', surface: 'now', ownerCore: 'Weather/Event', status: 'adapter_ready', demoRequired: true, description: 'General verified weather hazard when no more specific capability applies.' },
  { key: 'now.earthquake_alert', surface: 'now', ownerCore: 'Emergency/Event', status: 'adapter_ready', demoRequired: true, description: 'Verified earthquake/emergency event projected only when geographically relevant.' },
  { key: 'now.tsunami_alert', surface: 'now', ownerCore: 'Emergency/Event', status: 'adapter_ready', demoRequired: true, description: 'Verified tsunami alert for relevant coastal context.' },
  { key: 'now.strong_wind', surface: 'now', ownerCore: 'Weather/Event', status: 'adapter_ready', demoRequired: true, description: 'Strong-wind warning when action-changing.' },
  { key: 'now.snow_ice', surface: 'now', ownerCore: 'Weather/Road', status: 'adapter_ready', demoRequired: true, description: 'Snow or ice hazard affecting travel or daily activity.' },
  { key: 'now.wildfire_alert', surface: 'now', ownerCore: 'Emergency/Event', status: 'adapter_ready', demoRequired: true, description: 'Wildfire alert or active risk affecting the user area.' },
  { key: 'now.river_flood_alert', surface: 'now', ownerCore: 'Emergency/Event', status: 'adapter_ready', demoRequired: true, description: 'River or flood warning affecting the user area.' },
  { key: 'now.heat_cold', surface: 'now', ownerCore: 'Weather/Event', status: 'adapter_ready', demoRequired: true, description: 'Extreme heat or cold warning when relevant.' },
  { key: 'now.admin_deadline', surface: 'now', ownerCore: 'Public-Life', status: 'primitive_ready', demoRequired: true, description: 'Administrative renewal or deadline due soon.' },

  { key: 'progress.care_request', surface: 'in_progress', ownerCore: 'Care/Event', status: 'connected', demoRequired: true, description: 'Quote/request/service waiting state.' },
  { key: 'progress.order', surface: 'in_progress', ownerCore: 'Commerce', status: 'adapter_ready', demoRequired: true, description: 'Order accepted/preparing/refund state.' },
  { key: 'progress.municipal_application', surface: 'in_progress', ownerCore: 'Public-Life', status: 'adapter_ready', demoRequired: true, description: 'Municipal/public application processing state.' },
  { key: 'progress.community_membership', surface: 'in_progress', ownerCore: 'Community', status: 'adapter_ready', demoRequired: true, description: 'Community membership approval pending.' },
  { key: 'progress.job_application', surface: 'in_progress', ownerCore: 'Jobs', status: 'pending_core', demoRequired: true, description: 'Job application/interview process in progress.' },
  { key: 'progress.real_estate_inquiry', surface: 'in_progress', ownerCore: 'Real Estate', status: 'pending_core', demoRequired: true, description: 'Property inquiry/agent response process.' },
  { key: 'progress.logistics_delivery', surface: 'in_progress', ownerCore: 'Logistics', status: 'pending_core', demoRequired: true, description: 'Physical shipment/delivery status; distinct from message delivery.' },
  { key: 'progress.refund', surface: 'in_progress', ownerCore: 'Commerce/Payment', status: 'adapter_ready', demoRequired: true, description: 'Refund/reversal processing.' },

  { key: 'upcoming.health_appointment', surface: 'upcoming', ownerCore: 'Health', status: 'primitive_ready', demoRequired: true, description: 'Confirmed medical appointment or follow-up.' },
  { key: 'upcoming.school_event', surface: 'upcoming', ownerCore: 'School', status: 'primitive_ready', demoRequired: true, description: 'Confirmed school event/activity.' },
  { key: 'upcoming.community_event', surface: 'upcoming', ownerCore: 'Community', status: 'adapter_ready', demoRequired: true, description: 'Confirmed joined-community event.' },
  { key: 'upcoming.vehicle_lifecycle', surface: 'upcoming', ownerCore: 'Vehicle', status: 'primitive_ready', demoRequired: true, description: 'Inspection, permit, maintenance, or renewal.' },
  { key: 'upcoming.pet_lifecycle', surface: 'upcoming', ownerCore: 'Pets', status: 'primitive_ready', demoRequired: true, description: 'Vaccination, registration, or pet lifecycle event.' },
  { key: 'upcoming.job_interview', surface: 'upcoming', ownerCore: 'Jobs', status: 'pending_core', demoRequired: true, description: 'Confirmed interview or work start/shift.' },
  { key: 'upcoming.property_viewing', surface: 'upcoming', ownerCore: 'Real Estate', status: 'pending_core', demoRequired: true, description: 'Confirmed property viewing/meeting.' },
  { key: 'upcoming.reservation', surface: 'upcoming', ownerCore: 'Care/Event', status: 'primitive_ready', demoRequired: true, description: 'Confirmed reservation or appointment.' },
  { key: 'upcoming.admin_renewal', surface: 'upcoming', ownerCore: 'Public-Life', status: 'primitive_ready', demoRequired: true, description: 'Future administrative renewal/deadline.' },

  { key: 'today.municipal_benefit', surface: 'useful_today', ownerCore: 'Public-Life', status: 'adapter_ready', demoRequired: true, description: 'Relevant verified benefit/service.' },
  { key: 'today.community_notice', surface: 'useful_today', ownerCore: 'Community/School', status: 'adapter_ready', demoRequired: true, description: 'Important joined-space announcement.' },
  { key: 'today.local_news', surface: 'useful_today', ownerCore: 'News', status: 'adapter_ready', demoRequired: true, description: 'Recent relevant local news.' },
  { key: 'today.exchange_rate', surface: 'useful_today', ownerCore: 'Economy/Shared Data', status: 'adapter_ready', demoRequired: true, description: 'Headline exchange rate such as USD/CLP from a shared national snapshot.' },
  { key: 'today.uf', surface: 'useful_today', ownerCore: 'Economy/Shared Data', status: 'adapter_ready', demoRequired: true, description: 'Current UF reference value from a shared national snapshot.' },
  { key: 'today.food_prices', surface: 'useful_today', ownerCore: 'Food/ODEPA', status: 'adapter_ready', demoRequired: true, description: 'Relevant public food-price reference, separate from seasonality.' },
  { key: 'today.fuel_nearby', surface: 'useful_today', ownerCore: 'Fuel/CNE', status: 'adapter_ready', demoRequired: true, description: 'Nearby fuel price/change information from the canonical fuel source.' },
  { key: 'today.traffic_commute', surface: 'useful_today', ownerCore: 'Traffic/Mobility', status: 'adapter_ready', demoRequired: true, description: 'Meaningful commute delay or route-status signal.' },
  { key: 'today.vehicle_restriction', surface: 'useful_today', ownerCore: 'Environment/Vehicle', status: 'adapter_ready', demoRequired: true, description: 'RM vehicle restriction when active and relevant to the user vehicle.' },
  { key: 'today.road_condition', surface: 'useful_today', ownerCore: 'Road/Public Data', status: 'adapter_ready', demoRequired: true, description: 'Road restriction, snow, ice, rain or closure state when relevant.' },
  { key: 'today.border_crossing', surface: 'useful_today', ownerCore: 'Border/Public Data', status: 'adapter_ready', demoRequired: true, description: 'Relevant border pass opening, closure or restriction state.' },
  { key: 'today.maritime_forecast', surface: 'useful_today', ownerCore: 'Marine/Public Data', status: 'adapter_ready', demoRequired: true, description: 'Maritime forecast for relevant coastal context.' },
  { key: 'today.marine_alert', surface: 'useful_today', ownerCore: 'Marine/Public Data', status: 'adapter_ready', demoRequired: true, description: 'Relevant maritime/coastal alert such as marejadas.' },
  { key: 'today.tide', surface: 'useful_today', ownerCore: 'Marine/Public Data', status: 'adapter_ready', demoRequired: true, description: 'Tide context for relevant coastal users or destinations.' },
  { key: 'today.daily_brief', surface: 'useful_today', ownerCore: 'Daily Brief/News', status: 'adapter_ready', demoRequired: true, description: 'One concise daily brief across transport, economy, policy, safety, weather or culture.' },
  { key: 'today.chile_annual_rhythm', surface: 'useful_today', ownerCore: 'Chile Life/Calendar', status: 'primitive_ready', demoRequired: true, description: 'Chile seasonal/cultural rhythm such as Fiestas Patrias, vendimias, snow season or summer holidays.' },
  { key: 'today.interest_personalization', surface: 'useful_today', ownerCore: 'Personalization/Interest', status: 'primitive_ready', demoRequired: true, description: 'Explicit followed interests shape what Palta prioritizes and recommends on Home.' },
  { key: 'today.seasonal_fruit', surface: 'useful_today', ownerCore: 'Food/Seasonality', status: 'demo_only', demoRequired: true, description: 'Seasonal fruit relevant to Chile and the current period.' },
  { key: 'today.seasonal_vegetable', surface: 'useful_today', ownerCore: 'Food/Seasonality', status: 'demo_only', demoRequired: true, description: 'Seasonal vegetables relevant to Chile and the current period.' },
  { key: 'today.seasonal_seafood', surface: 'useful_today', ownerCore: 'Food/Seasonality', status: 'demo_only', demoRequired: true, description: 'Seasonal fish and seafood relevant to Chile and the current period.' },
  { key: 'today.panorama', surface: 'useful_today', ownerCore: 'Play/Culture', status: 'pending_core', demoRequired: true, description: 'Relevant nearby event or cultural activity.' },
  { key: 'today.followed_business_update', surface: 'useful_today', ownerCore: 'Local Business', status: 'pending_core', demoRequired: true, description: 'Meaningful update from a followed business, not generic advertising.' },
  { key: 'today.local_service_change', surface: 'useful_today', ownerCore: 'Public-Life', status: 'adapter_ready', demoRequired: true, description: 'Trash collection, road, office hours, or other local operational change.' },
  { key: 'today.jobs_nearby', surface: 'useful_today', ownerCore: 'Jobs', status: 'pending_core', demoRequired: true, description: 'Highly relevant nearby job opportunity when Home is otherwise light.' },
  { key: 'today.property_saved_change', surface: 'useful_today', ownerCore: 'Real Estate', status: 'pending_core', demoRequired: true, description: 'Meaningful change to a saved property/listing.' },
] as const;

export function requiredDemoCapabilityKeys(): string[] {
  return HOME_CAPABILITIES.filter((capability) => capability.demoRequired).map(
    (capability) => capability.key,
  );
}

export function homeCapability(key: string): HomeCapabilityDefinition | undefined {
  return HOME_CAPABILITIES.find((capability) => capability.key === key);
}
