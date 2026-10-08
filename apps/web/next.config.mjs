import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.API_INTERNAL_URL || 'http://localhost:4000') + '/api/:path*',
      },
    ];
  },
};
export default withNextIntl(nextConfig);
