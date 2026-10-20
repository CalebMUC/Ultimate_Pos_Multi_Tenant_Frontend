// The .NET API. In development the browser calls /api/v1 on this origin and Next proxies it, so no CORS is needed.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:5062';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  images: { unoptimized: true },
};

export default nextConfig;
