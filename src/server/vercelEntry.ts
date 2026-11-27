import { createApiApp } from './apiApp.ts';

export const config = {
  maxDuration: 60,
};

const app = createApiApp();

export default app;
