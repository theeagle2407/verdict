// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {},
  // Leave heavy optional wallet SDKs external during server bundling so a
  // transitive module-not-found (e.g. @coinbase/cdp-sdk) can't fail the build.
  serverExternalPackages: [
    "@coinbase/cdp-sdk",
    "@base-org/account",
  ],
};

module.exports = nextConfig;
