export type SupportedUiLocale = "es-CL" | "ko";

export interface LocaleStressCase {
  readonly id: string;
  readonly locale: SupportedUiLocale;
  readonly component:
    | "button"
    | "input"
    | "status_badge"
    | "card_title"
    | "card_body"
    | "bottom_sheet_title"
    | "navigation_label"
    | "empty_state";
  readonly text: string;
  readonly expectation: "single_line_when_possible" | "wrap_allowed" | "must_not_truncate_meaning";
}

export const LOCALE_STRESS_CASES: readonly LocaleStressCase[] = [
  {
    id: "es-button-long-action",
    locale: "es-CL",
    component: "button",
    text: "Revisar los detalles antes de continuar",
    expectation: "must_not_truncate_meaning",
  },
  {
    id: "es-sheet-title-reservation",
    locale: "es-CL",
    component: "bottom_sheet_title",
    text: "Opciones disponibles para cambiar tu reserva",
    expectation: "wrap_allowed",
  },
  {
    id: "es-status-stale",
    locale: "es-CL",
    component: "status_badge",
    text: "Información pendiente de actualización",
    expectation: "must_not_truncate_meaning",
  },
  {
    id: "es-empty-local-results",
    locale: "es-CL",
    component: "empty_state",
    text: "Todavía no encontramos resultados útiles en esta zona. Puedes ampliar el área de búsqueda.",
    expectation: "wrap_allowed",
  },
  {
    id: "ko-button-long-action",
    locale: "ko",
    component: "button",
    text: "계속하기 전에 자세한 내용을 확인하기",
    expectation: "must_not_truncate_meaning",
  },
  {
    id: "ko-sheet-title-reservation",
    locale: "ko",
    component: "bottom_sheet_title",
    text: "예약을 변경할 수 있는 방법을 확인해 주세요",
    expectation: "wrap_allowed",
  },
  {
    id: "ko-status-stale",
    locale: "ko",
    component: "status_badge",
    text: "업데이트 확인이 필요한 정보",
    expectation: "must_not_truncate_meaning",
  },
  {
    id: "ko-empty-local-results",
    locale: "ko",
    component: "empty_state",
    text: "이 지역에서 아직 유용한 결과를 찾지 못했습니다. 검색 범위를 넓혀 볼 수 있습니다.",
    expectation: "wrap_allowed",
  },
];

export interface LocaleQaRequirements {
  readonly supportsDynamicText: true;
  readonly avoidsFixedTextHeight: true;
  readonly allowsSemanticWrapping: true;
  readonly preservesOriginalUserContent: true;
  readonly officialUiFallbackOrder: readonly ["selected_locale", "es-CL", "source"];
}

export const LOCALE_QA_REQUIREMENTS: LocaleQaRequirements = {
  supportsDynamicText: true,
  avoidsFixedTextHeight: true,
  allowsSemanticWrapping: true,
  preservesOriginalUserContent: true,
  officialUiFallbackOrder: ["selected_locale", "es-CL", "source"],
};
