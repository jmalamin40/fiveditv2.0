/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false, // Disable SWC minify to avoid thread pool issues on shared hosting
  
  // Exclude admin folder from Next.js build
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/admin/**', '**/node_modules/**'],
    }
    return config
  },
  
  // Exclude admin from page extensions and other processing
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Exclude admin folder from static file serving
  distDir: '.next',
}

module.exports = nextConfig

