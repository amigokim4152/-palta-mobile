export type RasterDpi = 203 | 300 | 600;
export type RasterPolarity = 'black_is_1' | 'black_is_0';

export type PrintCanvas = {
  widthMm: number;
  heightMm: number;
  dpi: RasterDpi;
};

export type RenderedPrintArtifact = {
  id: string;
  kind: 'label_bitmap' | 'receipt_bitmap' | 'document_pdf';
  mimeType: 'image/png' | 'image/jpeg' | 'application/pdf';
  widthDots?: number;
  heightDots?: number;
  dpi?: RasterDpi;
  objectRef: string;
  sha256: string;
  monochrome: boolean;
  createdAt: string;
};

export type RasterPrinterTarget = {
  printerId: string;
  dpi: RasterDpi;
  maxWidthDots: number;
  supportsImage: boolean;
  preferredImageFormat: 'png' | 'raw_mono' | 'zpl_graphic' | 'brother_raster' | 'escpos_raster';
  polarity?: RasterPolarity;
};

export function mmToDots(mm: number, dpi: RasterDpi): number {
  if (!Number.isFinite(mm) || mm <= 0) throw new Error('Millimeters must be positive.');
  return Math.round((mm / 25.4) * dpi);
}

export function canvasToDots(canvas: PrintCanvas): { widthDots: number; heightDots: number } {
  return {
    widthDots: mmToDots(canvas.widthMm, canvas.dpi),
    heightDots: mmToDots(canvas.heightMm, canvas.dpi),
  };
}

export function assertRenderedArtifactFitsPrinter(
  artifact: RenderedPrintArtifact,
  target: RasterPrinterTarget,
): void {
  if (!target.supportsImage) {
    throw new Error('Printer target does not support image/raster printing.');
  }
  if (artifact.kind === 'document_pdf') return;
  if (!artifact.monochrome) {
    throw new Error('Thermal label/receipt artifact must be rendered as monochrome before dispatch.');
  }
  if (artifact.widthDots === undefined || artifact.heightDots === undefined || artifact.dpi === undefined) {
    throw new Error('Raster artifact is missing physical rendering metadata.');
  }
  if (artifact.dpi !== target.dpi) {
    throw new Error('Raster artifact DPI must match the physical printer target. Re-render before dispatch.');
  }
  if (artifact.widthDots > target.maxWidthDots) {
    throw new Error('Raster artifact exceeds printer width.');
  }
}

export type ImageFirstLabelTemplate = {
  id: string;
  version: number;
  canvas: PrintCanvas;
  /** Semantic data is rendered by Palta before transport; printers do not own layout. */
  renderMode: 'image_first';
};

/**
 * Palta renders the complete visual label before transport. Vendor adapters may
 * convert the bitmap to ZPL graphics, Brother raster, ESC/POS raster or another
 * device format, but they must not re-layout business content with device fonts.
 */
export function assertImageFirstTemplate(template: ImageFirstLabelTemplate): void {
  if (template.renderMode !== 'image_first') throw new Error('Label template must be image-first.');
  if (!template.id.trim() || !Number.isSafeInteger(template.version) || template.version < 1) {
    throw new Error('Label template requires a stable id and positive version.');
  }
  canvasToDots(template.canvas);
}
