import type { PrintDocument, PrinterProfile, PrinterStatus } from './printCore.js';

export type DeviceBridgeInfo = {
  id: string;
  platform: 'android' | 'windows' | 'macos' | 'linux' | 'ios';
  version: string;
  status: 'online' | 'degraded' | 'offline';
};

export type DiscoveredPrinter = {
  discoveryId: string;
  vendor?: string;
  model?: string;
  transport: 'usb' | 'bluetooth' | 'ethernet' | 'wifi' | 'os_queue' | 'embedded';
  protocolHint?: 'escpos' | 'zpl' | 'tspl' | 'brother_raster' | 'vendor_sdk' | 'ipp' | 'unknown';
  connectionHint?: string;
};

export type DeviceBridgePrintRequest = {
  printJobId: string;
  printer: PrinterProfile;
  document: PrintDocument;
  copies: number;
};

export type DeviceBridgePrintResult =
  | {
      outcome: 'printed';
      bridgeJobReference?: string;
      printerStatus?: PrinterStatus;
    }
  | {
      outcome: 'unknown';
      bridgeJobReference?: string;
      printerStatus?: PrinterStatus;
      reason: string;
    }
  | {
      outcome: 'failed';
      printerStatus?: PrinterStatus;
      code: string;
      retryable: boolean;
    };

/**
 * Local/native bridge contract. Web/POS UI sends structured print jobs here;
 * vendor/OS-specific USB, Bluetooth, LAN or driver logic stays behind this port.
 */
export interface DeviceBridgePort {
  getBridgeInfo(): Promise<DeviceBridgeInfo>;
  discoverPrinters(): Promise<readonly DiscoveredPrinter[]>;
  probePrinter(printer: PrinterProfile): Promise<PrinterStatus>;
  print(request: DeviceBridgePrintRequest): Promise<DeviceBridgePrintResult>;
}

export type BridgeHealthCheck = {
  bridgeReady: boolean;
  printerReady: boolean;
  actionableMessage:
    | 'ready'
    | 'bridge_not_running'
    | 'printer_offline'
    | 'paper_out'
    | 'cover_open'
    | 'printer_error'
    | 'printer_status_unknown';
};

export function decideBridgeHealth(
  bridge: DeviceBridgeInfo | null,
  printerStatus: PrinterStatus | null,
): BridgeHealthCheck {
  if (bridge === null || bridge.status === 'offline') {
    return {
      bridgeReady: false,
      printerReady: false,
      actionableMessage: 'bridge_not_running',
    };
  }
  if (printerStatus === null || printerStatus === 'unknown') {
    return {
      bridgeReady: true,
      printerReady: false,
      actionableMessage: 'printer_status_unknown',
    };
  }
  if (printerStatus === 'ready') {
    return { bridgeReady: true, printerReady: true, actionableMessage: 'ready' };
  }
  if (printerStatus === 'paper_out') {
    return { bridgeReady: true, printerReady: false, actionableMessage: 'paper_out' };
  }
  if (printerStatus === 'cover_open') {
    return { bridgeReady: true, printerReady: false, actionableMessage: 'cover_open' };
  }
  if (printerStatus === 'offline') {
    return { bridgeReady: true, printerReady: false, actionableMessage: 'printer_offline' };
  }
  return { bridgeReady: true, printerReady: false, actionableMessage: 'printer_error' };
}
