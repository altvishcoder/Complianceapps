import { test, expect } from '@playwright/test';

test.describe('Data Parity Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let dashboardCounts: {
    totalProperties: number;
    totalCertificates: number;
    openActions: number;
    complianceRate: number;
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should capture dashboard baseline counts', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const propertyStat = page.getByTestId('stat-total-properties');
    const certificateStat = page.getByTestId('stat-total-certificates');
    const complianceStat = page.getByTestId('stat-compliance-rate');
    
    await expect(propertyStat).toBeVisible();
    await expect(certificateStat).toBeVisible();
    await expect(complianceStat).toBeVisible();
    
    const propertyText = await propertyStat.textContent();
    const certificateText = await certificateStat.textContent();
    const complianceText = await complianceStat.textContent();
    
    dashboardCounts = {
      totalProperties: parseInt(propertyText?.replace(/[^0-9]/g, '') || '0'),
      totalCertificates: parseInt(certificateText?.replace(/[^0-9]/g, '') || '0'),
      openActions: 0,
      complianceRate: parseFloat(complianceText?.replace(/[^0-9.]/g, '') || '0'),
    };
    
    expect(dashboardCounts.totalProperties).toBeGreaterThan(0);
    expect(dashboardCounts.totalCertificates).toBeGreaterThan(0);
  });

  test('should validate API counts match dashboard', async ({ request }) => {
    const statsResponse = await request.get('/api/dashboard/stats');
    expect(statsResponse.ok()).toBeTruthy();
    
    const stats = await statsResponse.json();
    
    expect(stats).toHaveProperty('totalProperties');
    expect(stats).toHaveProperty('totalCertificates');
    expect(typeof stats.totalProperties).toBe('number');
    expect(typeof stats.totalCertificates).toBe('number');
    
    if (dashboardCounts) {
      expect(stats.totalProperties).toBe(dashboardCounts.totalProperties);
      expect(stats.totalCertificates).toBe(dashboardCounts.totalCertificates);
    }
  });

  test('should validate hierarchy API returns data', async ({ request }) => {
    const hierarchyResponse = await request.get('/api/analytics/hierarchy?level=stream');
    expect(hierarchyResponse.ok()).toBeTruthy();
    
    const hierarchy = await hierarchyResponse.json();
    expect(hierarchy).toHaveProperty('level');
    expect(hierarchy).toHaveProperty('data');
    expect(hierarchy.level).toBe('stream');
    expect(Array.isArray(hierarchy.data)).toBeTruthy();
    
    hierarchy.data.forEach((stream: any) => {
      expect(stream).toHaveProperty('id');
      expect(stream).toHaveProperty('name');
      expect(stream).toHaveProperty('propertyCount');
      expect(stream).toHaveProperty('complianceRate');
      expect(stream).toHaveProperty('riskLevel');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(stream.riskLevel);
    });
  });

  test('should validate treemap API returns data', async ({ request }) => {
    const treemapResponse = await request.get('/api/analytics/treemap?groupBy=stream');
    expect(treemapResponse.ok()).toBeTruthy();
    
    const treemap = await treemapResponse.json();
    expect(treemap).toHaveProperty('name');
    expect(treemap).toHaveProperty('children');
    expect(Array.isArray(treemap.children)).toBeTruthy();
    
    treemap.children.forEach((child: any) => {
      expect(child).toHaveProperty('name');
      expect(child).toHaveProperty('value');
      expect(child).toHaveProperty('complianceRate');
      expect(child).toHaveProperty('riskLevel');
    });
  });

  test('should validate hierarchy drill-down returns schemes', async ({ request }) => {
    const streamResponse = await request.get('/api/analytics/hierarchy?level=stream');
    const streams = await streamResponse.json();
    
    if (streams.data.length > 0) {
      const firstStream = streams.data[0];
      const schemeResponse = await request.get(`/api/analytics/hierarchy?level=scheme&parentId=${firstStream.id}`);
      expect(schemeResponse.ok()).toBeTruthy();
      
      const schemes = await schemeResponse.json();
      expect(schemes).toHaveProperty('level');
      expect(schemes.level).toBe('scheme');
      expect(schemes).toHaveProperty('parentId');
    }
  });

  test('should validate remedial actions count consistency', async ({ request }) => {
    const statsResponse = await request.get('/api/dashboard/stats');
    const stats = await statsResponse.json();
    
    const actionsResponse = await request.get('/api/remedial-actions');
    expect(actionsResponse.ok()).toBeTruthy();
    
    const actions = await actionsResponse.json();
    const openActions = actions.filter((a: any) => 
      !['COMPLETED', 'CANCELLED'].includes(a.status)
    );
    
    if (stats.openRemedialActions !== undefined) {
      expect(openActions.length).toBe(stats.openRemedialActions);
    }
  });

  test('should validate certificates count matches stats', async ({ request }) => {
    const statsResponse = await request.get('/api/dashboard/stats');
    const stats = await statsResponse.json();
    
    const certsResponse = await request.get('/api/certificates');
    expect(certsResponse.ok()).toBeTruthy();
    
    const certs = await certsResponse.json();
    
    if (stats.totalCertificates !== undefined) {
      expect(certs.length).toBe(stats.totalCertificates);
    }
  });
});

test.describe('Hierarchy Visualization Parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should display treemap page with data', async ({ page }) => {
    await page.goto('/analytics/asset-health');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByTestId('treemap-container')).toBeVisible({ timeout: 15000 });
    
    const summaryStats = page.getByTestId('portfolio-summary-stats');
    if (await summaryStats.isVisible()) {
      await expect(summaryStats).toBeVisible();
    }
  });

  test('should navigate hierarchy explorer levels', async ({ page }) => {
    await page.goto('/analytics/asset-health');
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('tab-explorer').click();
    
    const hierarchyExplorer = page.getByTestId('hierarchy-explorer');
    await expect(hierarchyExplorer).toBeVisible({ timeout: 10000 });
    
    const breadcrumb = page.getByTestId('hierarchy-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    const hierarchyItems = page.getByTestId('hierarchy-items');
    await expect(hierarchyItems).toBeVisible();
    
    const levelItems = page.getByTestId(/hierarchy-item-/);
    const itemCount = await levelItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should drill down when clicking hierarchy item', async ({ page }) => {
    await page.goto('/analytics/asset-health');
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('tab-explorer').click();
    
    await page.waitForTimeout(1000);
    
    const firstItem = page.getByTestId(/hierarchy-item-/).first();
    if (await firstItem.isVisible()) {
      await firstItem.click();
      
      await page.waitForTimeout(500);
      
      const breadcrumbStream = page.getByTestId(/breadcrumb-/);
      const breadcrumbCount = await breadcrumbStream.count();
      expect(breadcrumbCount).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('Cross-Page Count Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('input-username').fill('admin');
    await page.getByTestId('input-password').fill('admin123');
    await page.getByTestId('button-login').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should have consistent property counts across pages', async ({ page, request }) => {
    const apiResponse = await request.get('/api/properties');
    const properties = await apiResponse.json();
    const apiPropertyCount = properties.length;
    
    const dashboardStat = page.getByTestId('stat-total-properties');
    await expect(dashboardStat).toBeVisible();
    const dashboardText = await dashboardStat.textContent();
    const dashboardCount = parseInt(dashboardText?.replace(/[^0-9]/g, '') || '0');
    
    expect(dashboardCount).toBe(apiPropertyCount);
  });

  test('should have consistent certificate counts across pages', async ({ page, request }) => {
    const apiResponse = await request.get('/api/certificates');
    const certificates = await apiResponse.json();
    const apiCertCount = certificates.length;
    
    const dashboardStat = page.getByTestId('stat-total-certificates');
    await expect(dashboardStat).toBeVisible();
    const dashboardText = await dashboardStat.textContent();
    const dashboardCount = parseInt(dashboardText?.replace(/[^0-9]/g, '') || '0');
    
    expect(dashboardCount).toBe(apiCertCount);
  });
});
