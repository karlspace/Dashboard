import { Head, Html, Main, NextScript } from "next/document";

// Generate version timestamp at build time to ensure manifest updates on deploy
const MANIFEST_VERSION = Date.now();

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href={`/site.webmanifest?v=${MANIFEST_VERSION}`} crossOrigin="use-credentials" />
        <link rel="preload" href="/api/config/custom.css" as="style" />
        <link rel="stylesheet" href="/api/config/custom.css" /> {/* eslint-disable-line @next/next/no-css-tags */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
