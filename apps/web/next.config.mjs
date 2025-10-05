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

    // Handle WASM files for parquet-wasm
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async'
    })

    return config
  }
};

export default nextConfig;
