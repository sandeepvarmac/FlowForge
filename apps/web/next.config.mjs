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
      asyncWebAssembly: true,
      layers: true
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource'
    })

    // Fallback for fs module (needed for WASM file loading)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false
    }

    return config
  }
};

export default nextConfig;
