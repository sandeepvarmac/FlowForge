/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['parquet-wasm']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize DuckDB and parquet-wasm native modules for server-side only
      config.externals = config.externals || []
      config.externals.push({
        'duckdb': 'commonjs duckdb',
        'duckdb-async': 'commonjs duckdb-async',
        'parquet-wasm': 'commonjs parquet-wasm'
      })
    }
    return config
  }
};

export default nextConfig;

