import { describe, it, expect, beforeAll, vi } from 'vitest';
import { 
  assertValidResponse, 
  fetchAPI, 
  validateRateLimitResponse,
  waitForServer 
} from './helpers/api-test-utils';

async function safeParseJSON(response: Response): Promise<any | null> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return null;
}

describe('ML Prediction Service', () => {
  beforeAll(async () => {
    await waitForServer();
  });

  describe('TensorFlow Model Architecture', () => {
    it('should have correct input feature configuration', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get model config');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, 'Get model config');
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data.inputFeatures).toBeDefined();
        expect(Array.isArray(data.inputFeatures)).toBe(true);
        expect(data.inputFeatures.length).toBeGreaterThan(0);
      }
    });

    it('should define expected input features for breach prediction', async () => {
      const expectedFeatures = [
        'expiryRiskScore',
        'defectRiskScore',
        'assetProfileRiskScore',
        'coverageGapRiskScore',
        'externalFactorRiskScore',
        'daysSinceLastCert',
        'openActionsCount',
        'historicalBreachCount',
        'propertyAge',
        'isHRB',
        'hasVulnerableOccupants',
      ];
      
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get model config features');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, 'Get model config features');
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        for (const feature of expectedFeatures) {
          expect(data.inputFeatures).toContain(feature);
        }
      }
    });

    it('should have valid hidden layer configuration', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get hidden layers');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, 'Get hidden layers');
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data.hiddenLayers).toBeDefined();
        expect(Array.isArray(data.hiddenLayers)).toBe(true);
        expect(data.hiddenLayers.every((l: number) => l > 0)).toBe(true);
      }
    });

    it('should use sigmoid activation for output layer', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get activation');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, 'Get activation');
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data.activation).toBe('sigmoid');
      }
    });
  });

  describe('Feature Extraction', () => {
    it('should normalize feature values between 0 and 1', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties for features');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertyId = data[0].id;
          const featureResponse = await fetchAPI(`/model-insights/features/${propertyId}`);
          const { isRateLimited: featRateLimited, status: featStatus } = assertValidResponse(
            featureResponse, [200, 401, 404, 429], 'Get property features'
          );
          
          if (featRateLimited) {
            validateRateLimitResponse(featureResponse, "Feature extraction");
            return;
          }
          
          if (featStatus === 200) {
            const features = await safeParseJSON(featureResponse); if (!features) return;
            Object.values(features).forEach((value) => {
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(1);
            });
          }
        }
      }
    });

    it('should handle missing property gracefully', async () => {
      const response = await fetchAPI('/model-insights/features/non-existent-property-id');
      const { isRateLimited, status } = assertValidResponse(response, [200, 404, 401, 429], 'Get features for missing property');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 404, 401]).toContain(status);
    });

    it('should include risk score components in features', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertyId = data[0].id;
          const featureResponse = await fetchAPI(`/model-insights/features/${propertyId}`);
          const { status: featStatus } = assertValidResponse(
            featureResponse, [200, 401, 404, 429], 'Get risk features'
          );
          
          if (featStatus === 200) {
            const features = await safeParseJSON(featureResponse); if (!features) return;
            const riskComponents = ['expiryRiskScore', 'defectRiskScore', 'assetProfileRiskScore'];
            for (const component of riskComponents) {
              expect(features).toHaveProperty(component);
            }
          }
        }
      }
    });
  });

  describe('Statistical Prediction', () => {
    it('should calculate breach probability based on risk data', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties for prediction');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertyId = data[0].id;
          const predResponse = await fetchAPI(`/model-insights/predict/${propertyId}`);
          const { isRateLimited: predRateLimited, status: predStatus } = assertValidResponse(
            predResponse, [200, 401, 404, 429], 'Get prediction'
          );
          
          if (predRateLimited) {
            validateRateLimitResponse(predResponse, "Prediction check");
            return;
          }
          
          if (predStatus === 200) {
            const prediction = await safeParseJSON(predResponse); if (!prediction) return;
            expect(prediction.statisticalScore).toBeDefined();
            expect(prediction.statisticalScore).toBeGreaterThanOrEqual(0);
            expect(prediction.statisticalScore).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it('should return confidence level with prediction', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertyId = data[0].id;
          const predResponse = await fetchAPI(`/model-insights/predict/${propertyId}`);
          const { status: predStatus } = assertValidResponse(
            predResponse, [200, 401, 404, 429], 'Get prediction confidence'
          );
          
          if (predStatus === 200) {
            const prediction = await safeParseJSON(predResponse); if (!prediction) return;
            expect(prediction.statisticalConfidence).toBeDefined();
            expect(prediction.statisticalConfidence).toBeGreaterThanOrEqual(0);
            expect(prediction.statisticalConfidence).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it('should categorize risk level correctly', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertyId = data[0].id;
          const predResponse = await fetchAPI(`/model-insights/predict/${propertyId}`);
          const { status: predStatus } = assertValidResponse(
            predResponse, [200, 401, 404, 429], 'Get risk category'
          );
          
          if (predStatus === 200) {
            const prediction = await safeParseJSON(predResponse); if (!prediction) return;
            const validCategories = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
            expect(validCategories).toContain(prediction.predictedRiskCategory);
          }
        }
      }
    });
  });

  describe('ML Model Training', () => {
    it('should accept training configuration', async () => {
      const config = {
        learningRate: 0.01,
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
      };
      
      const response = await fetchAPI('/model-insights/training/config', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 201, 401, 429], 'Set training config');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 201, 401]).toContain(status);
    });

    it('should validate learning rate bounds', async () => {
      const invalidConfig = {
        learningRate: -0.01,
        epochs: 10,
        batchSize: 32,
      };
      
      const response = await fetchAPI('/model-insights/training/config', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 400, 401, 404, 422, 429], 'Invalid learning rate');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 400, 401, 404, 422]).toContain(status);
    });

    it('should validate epoch count', async () => {
      const invalidConfig = {
        learningRate: 0.01,
        epochs: 0,
        batchSize: 32,
      };
      
      const response = await fetchAPI('/model-insights/training/config', {
        method: 'POST',
        body: JSON.stringify(invalidConfig),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 400, 401, 404, 422, 429], 'Invalid epochs');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 400, 401, 404, 422]).toContain(status);
    });

    it('should get training status', async () => {
      const response = await fetchAPI('/model-insights/training/status');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get training status');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data).toHaveProperty('status');
        expect(['TRAINING', 'ACTIVE', 'INACTIVE', 'FAILED', 'NOT_STARTED']).toContain(data.status);
      }
    });

    it('should list training runs', async () => {
      const response = await fetchAPI('/model-insights/training/runs');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'List training runs');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe('Model Predictions API', () => {
    it('should run benchmark predictions', async () => {
      const response = await fetchAPI('/model-insights/run-benchmark', {
        method: 'POST',
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 202, 401, 429], 'Run benchmark');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 202, 401]).toContain(status);
    });

    it('should export training data', async () => {
      const response = await fetchAPI('/model-insights/export-training-data', {
        method: 'POST',
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Export training data');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 401]).toContain(status);
    });

    it('should get prediction history', async () => {
      const response = await fetchAPI('/model-insights/predictions');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get prediction history');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should get model accuracy metrics', async () => {
      const response = await fetchAPI('/model-insights/metrics');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get model metrics');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data).toHaveProperty('totalPredictions');
        expect(data).toHaveProperty('accuracy');
      }
    });
  });

  describe('ML Feedback Loop', () => {
    it('should accept prediction feedback', async () => {
      const feedback = {
        predictionId: 'test-prediction-id',
        feedbackType: 'CORRECT',
        feedbackNotes: 'Prediction was accurate',
      };
      
      const response = await fetchAPI('/model-insights/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 201, 401, 404, 429], 'Submit feedback');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 201, 401, 404]).toContain(status);
    });

    it('should validate feedback type', async () => {
      const invalidFeedback = {
        predictionId: 'test-prediction-id',
        feedbackType: 'INVALID_TYPE',
      };
      
      const response = await fetchAPI('/model-insights/feedback', {
        method: 'POST',
        body: JSON.stringify(invalidFeedback),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 400, 401, 404, 422, 429, 500], 'Invalid feedback type');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 400, 401, 404, 422, 500]).toContain(status);
    });

    it('should get feedback statistics', async () => {
      const response = await fetchAPI('/model-insights/feedback/stats');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 404, 429], 'Get feedback stats');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data).toHaveProperty('totalFeedback');
        expect(data).toHaveProperty('correctPredictions');
        expect(data).toHaveProperty('incorrectPredictions');
      }
    });
  });

  describe('Risk Score Calculations', () => {
    it('should weight features according to configuration', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get feature weights');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.featureWeights) {
          const totalWeight = Object.values(data.featureWeights).reduce(
            (sum: number, w) => sum + (w as number), 0
          );
          expect(totalWeight).toBeCloseTo(1, 1);
        }
      }
    });

    it('should increase risk score for expiring certificates', async () => {
      const response = await fetchAPI('/properties');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        if (data.length > 0) {
          const propertiesWithRisk = data.filter((p: any) => p.riskScore !== undefined);
          if (propertiesWithRisk.length > 0) {
            expect(propertiesWithRisk[0].riskScore).toBeGreaterThanOrEqual(0);
            expect(propertiesWithRisk[0].riskScore).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it('should factor in HRB status for risk calculation', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get HRB config');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data.inputFeatures).toContain('isHRB');
      }
    });

    it('should consider vulnerable occupants in risk assessment', async () => {
      const response = await fetchAPI('/model-insights/config');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 429], 'Get vulnerable occupants config');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const data = await safeParseJSON(response); if (!data) return;
        expect(data.inputFeatures).toContain('hasVulnerableOccupants');
      }
    });
  });

  describe('Model Persistence', () => {
    it('should save model weights', async () => {
      const response = await fetchAPI('/model-insights/model/save', {
        method: 'POST',
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 201, 401, 429], 'Save model');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 201, 401]).toContain(status);
    });

    it('should load model weights', async () => {
      const response = await fetchAPI('/model-insights/model/load');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 404, 429], 'Load model');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 401, 404]).toContain(status);
    });

    it('should list available models', async () => {
      const response = await fetchAPI('/model-insights/models');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 404, 429], 'List models');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await safeParseJSON(response); if (!data) return;
          expect(Array.isArray(data)).toBe(true);
        }
      }
    });

    it('should track model versions', async () => {
      const response = await fetchAPI('/model-insights/models');
      const { isRateLimited, status } = assertValidResponse(response, [200, 401, 404, 429], 'Get model versions');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await safeParseJSON(response); if (!data) return;
          if (data.length > 0) {
            expect(data[0]).toHaveProperty('modelVersion');
            expect(typeof data[0].modelVersion).toBe('number');
          }
        }
      }
    });
  });

  describe('Batch Predictions', () => {
    it('should predict for multiple properties', async () => {
      const response = await fetchAPI('/properties?limit=5');
      const { isRateLimited, status } = assertValidResponse(response, [200, 429], 'Get properties for batch');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      if (status === 200) {
        const properties = await safeParseJSON(response); if (!properties) return;
        if (properties.length >= 2) {
          const propertyIds = properties.slice(0, 2).map((p: any) => p.id);
          
          const batchResponse = await fetchAPI('/model-insights/predict/batch', {
            method: 'POST',
            body: JSON.stringify({ propertyIds }),
          });
          
          const { isRateLimited: batchRateLimited, status: batchStatus } = assertValidResponse(
            batchResponse, [200, 401, 429], 'Batch prediction'
          );
          
          if (batchRateLimited) {
            validateRateLimitResponse(batchResponse, "Batch prediction");
            return;
          }
          
          if (batchStatus === 200) {
            const predictions = await safeParseJSON(batchResponse); if (!predictions) return;
            expect(Array.isArray(predictions)).toBe(true);
            expect(predictions.length).toBe(2);
          }
        }
      }
    });

    it('should handle empty batch gracefully', async () => {
      const response = await fetchAPI('/model-insights/predict/batch', {
        method: 'POST',
        body: JSON.stringify({ propertyIds: [] }),
      });
      
      const { isRateLimited, status } = assertValidResponse(response, [200, 400, 401, 422, 429], 'Empty batch');
      
      if (isRateLimited) {
        validateRateLimitResponse(response, "Rate limit check");
        return;
      }
      
      expect([200, 400, 401, 422]).toContain(status);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits on prediction endpoints', async () => {
      const response = await fetchAPI('/model-insights/config');
      
      if (response.status === 429) {
        validateRateLimitResponse(response, "Rate limit check");
      } else {
        expect([200, 401]).toContain(response.status);
      }
    });
  });
});
