import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('DATABASE_URL must be configured for production database commands.'); })()
      : 'postgres://postgres:postgres@127.0.0.1:5439/template1?sslmode=disable'),
  },
});
