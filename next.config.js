/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false, // Disable SWC minify to avoid thread pool issues on shared hosting
}

module.exports = nextConfig

