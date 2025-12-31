import { beforeAll, afterAll } from 'vitest';

const TEST_API_URL = process.env.TEST_API_URL || 'http://localhost:5000';

beforeAll(async () => {
  let retries = 0;
  const maxRetries = 10;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${TEST_API_URL}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        console.log('Server is ready for testing');
        return;
      }
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        console.log(`Waiting for server... (attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.warn('Server may not be fully ready, proceeding with tests');
});

afterAll(() => {
  console.log('Tests completed');
});
