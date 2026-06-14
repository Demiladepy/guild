/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@guild/core",
    "@metamask/smart-accounts-kit",
    "@metamask/x402",
    "@x402/core",
    "@x402/fetch",
  ],
};

export default nextConfig;
