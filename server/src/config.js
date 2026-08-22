import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  neo4j: {
    uri: process.env.COGNODB_URI || '',
    user: process.env.COGNODB_USER || 'cognodb',
    password: process.env.COGNODB_PASSWORD || '',
  },
  // Serve endpoints from in-memory seed data when no database is configured.
  demoMode:
    process.env.DEMO_MODE === 'true' ||
    !process.env.COGNODB_URI ||
    !process.env.COGNODB_PASSWORD,
};

export default config;
