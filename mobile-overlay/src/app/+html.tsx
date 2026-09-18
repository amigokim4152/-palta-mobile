import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const baseUrl = process.env.EXPO_BASE_URL ?? '';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-CL">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#315C3B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Palta" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href={`${baseUrl}/manifest.json`} />
        <link rel="icon" href={`${baseUrl}/palta-icon.svg`} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={`${baseUrl}/palta-icon.svg`} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { min-height: 100%; }
          body { margin: 0; background: #F7F7F2; overscroll-behavior-y: none; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
