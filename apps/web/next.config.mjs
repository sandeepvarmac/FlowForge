/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize DuckDB native modules for server-side only
      config.externals = config.externals || []
      config.externals.push({
        'duckdb': 'commonjs duckdb',
        'duckdb-async': 'commonjs duckdb-async'
      })
    }
    return config
  }
};

export default nextConfig;

