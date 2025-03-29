/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: "http://127.0.0.1:3001/api/py/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
