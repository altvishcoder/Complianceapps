import { beforeAll, afterAll } from 'vitest';

const TEST_API_URL = process.env.TEST_API_URL || 'http://localhost:5000';

beforeAll(async () => {
  let retries = 0;
  const maxRetries = 15;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${TEST_API_URL}/api/version`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok || response.status === 429) {
        console.log('Server is ready for testing');
        return;
      }
    } catch {
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
  
  console.warn('Server may not be fully ready, proceeding with tests');
}, 45000);

afterAll(() => {
  console.log('Tests completed');
});
