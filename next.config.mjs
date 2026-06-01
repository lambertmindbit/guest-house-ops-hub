/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-ical is a CJS package that doesn't bundle cleanly; load it at runtime.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;
