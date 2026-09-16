import type { PaltaEvent } from './eventBusPort.js';

export function shouldDedupeEvents(
  a: PaltaEvent,
  b: PaltaEvent,
): boolean {
  return (
    Boolean(a.dedupeKey) &&
    a.dedupeKey === b.dedupeKey &&
    a.type === b.type
  );
}

export function eventAffectsSubject(
  event: PaltaEvent,
  subjectRef: string,
): boolean {
  return event.subjectRef === subjectRef;
}
