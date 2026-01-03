import * as tf from '@tensorflow/tfjs-node';
import { db } from '../db';
import { 
  mlModels, 
  mlPredictions, 
  mlFeedback, 
  mlTrainingRuns,
  properties,
  certificates,
  remedialActions,
  schemes,
  blocks
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql, count, or } from 'drizzle-orm';
import { logger } from '../logger';
import { calculatePropertyRiskScore, type PropertyRiskData, type RiskTier } from './risk-scoring';

const ML_LOGGER = logger.child({ component: 'ml-tensorflow' });

let cachedTensorFlowModel: tf.Sequential | null = null;
let cachedTensorFlowModelId: string | null = null;

class TensorFlowModel {
  private model: tf.Sequential;
  private config: MLModelConfig;

  constructor(config: MLModelConfig) {
    this.config = config;
    this.model = this.buildModel();
  }

  private buildModel(): tf.Sequential {
    const model = tf.sequential();
    
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [this.config.inputFeatures.length],
      kernelInitializer: 'heNormal'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: 'heNormal'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.1 }));
    
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  private weightsLoaded: boolean = false;

  loadWeights(weights: Array<{ data: number[]; shape: number[] }>): boolean {
    if (!weights || weights.length === 0) {
      ML_LOGGER.warn('No weights provided');
      return false;
    }

    try {
      const tensors = weights.map(w => tf.tensor(w.data, w.shape));
      this.model.setWeights(tensors);
      tensors.forEach(t => t.dispose());
      this.weightsLoaded = true;
      ML_LOGGER.info('TensorFlow model weights loaded successfully');
      return true;
    } catch (err) {
      ML_LOGGER.warn({ err }, 'Failed to load TensorFlow weights');
      this.weightsLoaded = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.weightsLoaded;
  }

  getWeightsWithShapes(): Array<{ data: number[]; shape: number[] }> {
    return this.model.getWeights().map(w => ({
      data: Array.from(w.dataSync()),
      shape: w.shape as number[]
    }));
  }

  predict(featureVector: number[]): { score: number; confidence: number } {
    const inputTensor = tf.tensor2d([featureVector], [1, this.config.inputFeatures.length]);
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const score = (prediction.dataSync()[0]) * 100;
    
    inputTensor.dispose();
    prediction.dispose();
    
    return {
      score: Math.round(score),
      confidence: 70
    };
  }

  async train(
    trainingData: { input: number[]; target: number }[],
    config: TrainingConfig,
    onProgress?: (epoch: number, loss: number, accuracy: number) => void
  ): Promise<{ finalLoss: number; finalAccuracy: number; epochHistory: Array<{ epoch: number; loss: number; accuracy: number }> }> {
    const xs = tf.tensor2d(
      trainingData.map(d => d.input),
      [trainingData.length, this.config.inputFeatures.length]
    );
    const ys = tf.tensor2d(
      trainingData.map(d => [d.target / 100]),
      [trainingData.length, 1]
    );

    const epochHistory: Array<{ epoch: number; loss: number; accuracy: number }> = [];

    const result = await this.model.fit(xs, ys, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const loss = logs?.loss ?? 0;
          const acc = logs?.acc ?? 0;
          epochHistory.push({ epoch, loss, accuracy: acc * 100 });
          if (onProgress && epoch % 10 === 0) {
            onProgress(epoch, loss, acc * 100);
          }
        }
      }
    });

    xs.dispose();
    ys.dispose();

    const finalLoss = result.history.loss[result.history.loss.length - 1] as number;
    const finalAcc = ((result.history.acc?.[result.history.acc.length - 1] as number) ?? 0) * 100;

    ML_LOGGER.info({ samples: trainingData.length, finalLoss, finalAcc }, 'TensorFlow model training completed');

    return { finalLoss, finalAccuracy: finalAcc, epochHistory };
  }

  getModel(): tf.Sequential {
    return this.model;
  }
}

interface TensorFlowWeightFormat {
  data: number[];
  shape: number[];
}

function isNewWeightFormat(weights: unknown): weights is TensorFlowWeightFormat[] {
  if (!Array.isArray(weights) || weights.length === 0) return false;
  const first = weights[0];
  return first && typeof first === 'object' && 'data' in first && 'shape' in first;
}

async function getOrLoadTensorFlowModel(
  organisationId: string,
  modelData: typeof mlModels.$inferSelect | null
): Promise<TensorFlowModel | null> {
  if (!modelData || modelData.status !== 'ACTIVE') {
    return null;
  }

  const weights = modelData.modelWeights;
  
  if (!weights || !isNewWeightFormat(weights)) {
    ML_LOGGER.debug('No TensorFlow-compatible weights found (old format or missing), skipping TensorFlow');
    return null;
  }

  if (cachedTensorFlowModelId === modelData.id && cachedTensorFlowModel) {
    const tfModel = new TensorFlowModel(modelData.modelConfig as MLModelConfig);
    const loaded = tfModel.loadWeights(weights);
    if (!loaded) {
      ML_LOGGER.warn('Failed to load cached weights, returning null');
      return null;
    }
    return tfModel;
  }

  const tfModel = new TensorFlowModel(modelData.modelConfig as MLModelConfig);
  const loaded = tfModel.loadWeights(weights);
  
  if (!loaded) {
    ML_LOGGER.warn('Failed to load TensorFlow weights, returning null for fallback');
    return null;
  }

  cachedTensorFlowModel = tfModel.getModel();
  cachedTensorFlowModelId = modelData.id;

  return tfModel;
}

export interface MLModelConfig {
  inputFeatures: string[];
  hiddenLayers: number[];
  outputSize: number;
  activation: string;
}

export interface MLPredictionResult {
  propertyId: string;
  predictionType: 'BREACH_PROBABILITY' | 'DAYS_TO_BREACH' | 'RISK_CATEGORY';
  statisticalScore: number;
  statisticalConfidence: number;
  mlScore: number | null;
  mlConfidence: number | null;
  predictedBreachDate: Date | null;
  predictedDaysToBreach: number | null;
  predictedRiskCategory: string | null;
  inputFeatures: Record<string, number>;
  combinedScore: number;
  combinedConfidence: number;
  sourceLabel: 'Statistical' | 'ML-Enhanced' | 'ML-Only';
}

export interface TrainingConfig {
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  learningRate: 0.01,
  epochs: 100,
  batchSize: 32,
  validationSplit: 0.2,
};

const DEFAULT_MODEL_CONFIG: MLModelConfig = {
  inputFeatures: [
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
  ],
  hiddenLayers: [16, 8],
  outputSize: 1,
  activation: 'sigmoid',
};

const DEFAULT_FEATURE_WEIGHTS: Record<string, number> = {
  expiryRiskScore: 0.25,
  defectRiskScore: 0.20,
  assetProfileRiskScore: 0.15,
  coverageGapRiskScore: 0.15,
  externalFactorRiskScore: 0.10,
  daysSinceLastCert: 0.05,
  openActionsCount: 0.05,
  historicalBreachCount: 0.05,
};

class SimpleNeuralNetwork {
  private weights: number[][];
  private biases: number[];
  private config: MLModelConfig;

  constructor(config: MLModelConfig, weights?: number[][]) {
    this.config = config;
    if (weights) {
      this.weights = weights;
      this.biases = new Array(config.hiddenLayers.length + 1).fill(0);
    } else {
      this.weights = this.initializeWeights();
      this.biases = new Array(config.hiddenLayers.length + 1).fill(0).map(() => Math.random() * 0.1);
    }
  }

  private initializeWeights(): number[][] {
    const layers = [this.config.inputFeatures.length, ...this.config.hiddenLayers, this.config.outputSize];
    const weights: number[][] = [];
    
    for (let i = 0; i < layers.length - 1; i++) {
      const layerWeights: number[] = [];
      const scale = Math.sqrt(2 / layers[i]);
      for (let j = 0; j < layers[i] * layers[i + 1]; j++) {
        layerWeights.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(layerWeights);
    }
    
    return weights;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  private sigmoidDerivative(x: number): number {
    const s = this.sigmoid(x);
    return s * (1 - s);
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private reluDerivative(x: number): number {
    return x > 0 ? 1 : 0;
  }

  private forwardPass(inputFeatures: number[]): { activations: number[][]; preActivations: number[][] } {
    const layers = [this.config.inputFeatures.length, ...this.config.hiddenLayers, this.config.outputSize];
    const activations: number[][] = [inputFeatures];
    const preActivations: number[][] = [inputFeatures];
    let current = inputFeatures;
    
    for (let layerIdx = 0; layerIdx < this.weights.length; layerIdx++) {
      const inputSize = layers[layerIdx];
      const outputSize = layers[layerIdx + 1];
      const layerWeights = this.weights[layerIdx];
      const preAct: number[] = [];
      const next: number[] = [];
      
      for (let j = 0; j < outputSize; j++) {
        let sum = this.biases[layerIdx] || 0;
        for (let i = 0; i < inputSize; i++) {
          sum += current[i] * layerWeights[i * outputSize + j];
        }
        preAct.push(sum);
        if (layerIdx === this.weights.length - 1) {
          next.push(this.sigmoid(sum));
        } else {
          next.push(this.relu(sum));
        }
      }
      preActivations.push(preAct);
      activations.push(next);
      current = next;
    }
    
    return { activations, preActivations };
  }

  predict(inputFeatures: number[]): number {
    const { activations } = this.forwardPass(inputFeatures);
    return activations[activations.length - 1][0] * 100;
  }

  train(
    trainingData: { input: number[]; target: number }[],
    config: TrainingConfig,
    onProgress?: (epoch: number, loss: number, accuracy: number) => void
  ): { finalLoss: number; finalAccuracy: number; epochHistory: Array<{ epoch: number; loss: number; accuracy: number }> } {
    const learningRate = config.learningRate;
    const epochHistory: Array<{ epoch: number; loss: number; accuracy: number }> = [];
    const layers = [this.config.inputFeatures.length, ...this.config.hiddenLayers, this.config.outputSize];
    
    for (let epoch = 0; epoch < config.epochs; epoch++) {
      let totalLoss = 0;
      let correct = 0;
      
      const shuffled = [...trainingData].sort(() => Math.random() - 0.5);
      
      for (const sample of shuffled) {
        const { activations, preActivations } = this.forwardPass(sample.input);
        const prediction = activations[activations.length - 1][0];
        const target = sample.target / 100;
        const outputError = target - prediction;
        
        totalLoss += outputError * outputError;
        
        if (Math.abs(prediction * 100 - sample.target) < 15) {
          correct++;
        }
        
        const deltas: number[][] = new Array(this.weights.length);
        
        const outputDelta = outputError * this.sigmoidDerivative(preActivations[preActivations.length - 1][0]);
        deltas[this.weights.length - 1] = [outputDelta];
        
        for (let layerIdx = this.weights.length - 2; layerIdx >= 0; layerIdx--) {
          const inputSize = layers[layerIdx + 1];
          const outputSize = layers[layerIdx + 2];
          const layerWeights = this.weights[layerIdx + 1];
          const currentDeltas: number[] = [];
          
          for (let i = 0; i < inputSize; i++) {
            let errorSum = 0;
            for (let j = 0; j < outputSize; j++) {
              errorSum += deltas[layerIdx + 1][j] * layerWeights[i * outputSize + j];
            }
            const derivative = this.reluDerivative(preActivations[layerIdx + 1][i]);
            currentDeltas.push(errorSum * derivative);
          }
          deltas[layerIdx] = currentDeltas;
        }
        
        for (let layerIdx = 0; layerIdx < this.weights.length; layerIdx++) {
          const inputSize = layers[layerIdx];
          const outputSize = layers[layerIdx + 1];
          const layerActivations = activations[layerIdx];
          const layerDeltas = deltas[layerIdx];
          
          for (let i = 0; i < inputSize; i++) {
            for (let j = 0; j < outputSize; j++) {
              const gradient = layerActivations[i] * layerDeltas[j];
              this.weights[layerIdx][i * outputSize + j] += learningRate * gradient;
            }
          }
          
          if (this.biases[layerIdx] !== undefined) {
            for (let j = 0; j < outputSize; j++) {
              this.biases[layerIdx] += learningRate * layerDeltas[j] * 0.1;
            }
          }
        }
      }
      
      const avgLoss = totalLoss / trainingData.length;
      const accuracy = (correct / trainingData.length) * 100;
      
      epochHistory.push({ epoch, loss: avgLoss, accuracy });
      
      if (onProgress && epoch % 10 === 0) {
        onProgress(epoch, avgLoss, accuracy);
      }
    }
    
    const lastEpoch = epochHistory[epochHistory.length - 1];
    return {
      finalLoss: lastEpoch.loss,
      finalAccuracy: lastEpoch.accuracy,
      epochHistory,
    };
  }

  getWeights(): number[][] {
    return this.weights;
  }
}

export async function getOrCreateModel(
  organisationId: string,
  predictionType: 'BREACH_PROBABILITY' | 'DAYS_TO_BREACH' | 'RISK_CATEGORY' = 'BREACH_PROBABILITY'
): Promise<typeof mlModels.$inferSelect | null> {
  const existing = await db.select()
    .from(mlModels)
    .where(and(
      eq(mlModels.organisationId, organisationId),
      eq(mlModels.predictionType, predictionType),
      eq(mlModels.isActive, true)
    ))
    .orderBy(desc(mlModels.modelVersion))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [newModel] = await db.insert(mlModels)
    .values({
      organisationId,
      modelName: `Breach Predictor v1`,
      predictionType,
      status: 'TRAINING',
      modelConfig: DEFAULT_MODEL_CONFIG,
      featureWeights: DEFAULT_FEATURE_WEIGHTS,
      learningRate: String(DEFAULT_TRAINING_CONFIG.learningRate),
      epochs: DEFAULT_TRAINING_CONFIG.epochs,
      batchSize: DEFAULT_TRAINING_CONFIG.batchSize,
    })
    .returning();

  return newModel;
}

export async function extractPropertyFeatures(
  propertyId: string,
  riskData?: PropertyRiskData
): Promise<Record<string, number>> {
  if (!riskData) {
    const prop = await db.select({ organisationId: schemes.organisationId })
      .from(properties)
      .innerJoin(blocks, eq(properties.blockId, blocks.id))
      .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
      .where(eq(properties.id, propertyId))
      .limit(1);
    
    if (prop.length === 0 || !prop[0].organisationId) return {};
    
    riskData = await calculatePropertyRiskScore(propertyId, prop[0].organisationId);
  }

  const certs = await db.select({
    issueDate: certificates.issueDate,
    expiryDate: certificates.expiryDate,
  })
  .from(certificates)
  .where(eq(certificates.propertyId, propertyId))
  .orderBy(desc(certificates.issueDate))
  .limit(1);

  const actions = await db.select({ id: remedialActions.id })
    .from(remedialActions)
    .where(and(
      eq(remedialActions.propertyId, propertyId),
      or(
        eq(remedialActions.status, 'OPEN'),
        eq(remedialActions.status, 'IN_PROGRESS')
      )
    ));

  const now = new Date();
  let daysSinceLastCert = 365;
  if (certs.length > 0 && certs[0].issueDate) {
    const issueDate = new Date(certs[0].issueDate);
    daysSinceLastCert = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    expiryRiskScore: riskData.expiryRiskScore / 100,
    defectRiskScore: riskData.defectRiskScore / 100,
    assetProfileRiskScore: riskData.assetProfileRiskScore / 100,
    coverageGapRiskScore: riskData.coverageGapRiskScore / 100,
    externalFactorRiskScore: riskData.externalFactorRiskScore / 100,
    daysSinceLastCert: Math.min(daysSinceLastCert / 365, 1),
    openActionsCount: Math.min(actions.length / 10, 1),
    historicalBreachCount: 0,
    propertyAge: (riskData.factorBreakdown.assetAge || 20) / 100,
    isHRB: riskData.factorBreakdown.isHRB ? 1 : 0,
    hasVulnerableOccupants: riskData.factorBreakdown.hasVulnerableOccupants ? 1 : 0,
  };
}

export async function calculateStatisticalPrediction(
  propertyId: string,
  organisationId: string
): Promise<{ score: number; confidence: number; riskData: PropertyRiskData }> {
  const riskData = await calculatePropertyRiskScore(propertyId, organisationId);
  
  let confidence = 85;
  
  if (riskData.factorBreakdown.expiringCertificates > 0 || riskData.factorBreakdown.overdueCertificates > 0) {
    confidence = 95;
  } else if (riskData.factorBreakdown.openDefects > 0) {
    confidence = 90;
  } else if (riskData.factorBreakdown.missingStreams.length > 0) {
    confidence = 80;
  }

  return {
    score: riskData.overallScore,
    confidence,
    riskData,
  };
}

interface PredictionOptions {
  isTest?: boolean;
}

export async function predictPropertyBreach(
  propertyId: string,
  organisationId: string,
  options: PredictionOptions = {}
): Promise<MLPredictionResult> {
  const { isTest = false } = options;
  const model = await getOrCreateModel(organisationId, 'BREACH_PROBABILITY');
  
  const { score: statisticalScore, confidence: statisticalConfidence, riskData } = 
    await calculateStatisticalPrediction(propertyId, organisationId);
  
  const inputFeatures = await extractPropertyFeatures(propertyId, riskData);
  
  let mlScore: number | null = null;
  let mlConfidence: number | null = null;
  let sourceLabel: 'Statistical' | 'ML-Enhanced' | 'ML-Only' = 'Statistical';
  
  if (model && model.status === 'ACTIVE' && model.modelWeights) {
    const featureVector = DEFAULT_MODEL_CONFIG.inputFeatures.map(
      feature => inputFeatures[feature] || 0
    );
    
    try {
      const tfModel = await getOrLoadTensorFlowModel(organisationId, model);
      if (tfModel) {
        const tfPrediction = tfModel.predict(featureVector);
        mlScore = tfPrediction.score;
        
        const modelAccuracy = parseFloat(model.trainingAccuracy || '50');
        const feedbackCount = model.feedbackCount || 0;
        mlConfidence = Math.min(
          Math.round(40 + (modelAccuracy * 0.4) + Math.min(feedbackCount * 2, 20)),
          95
        );
        
        sourceLabel = 'ML-Enhanced';
        ML_LOGGER.debug({ propertyId, mlScore, mlConfidence }, 'TensorFlow prediction successful');
      } else {
        const nn = new SimpleNeuralNetwork(
          model.modelConfig as MLModelConfig,
          model.modelWeights as number[][]
        );
        mlScore = Math.round(nn.predict(featureVector));
        
        const modelAccuracy = parseFloat(model.trainingAccuracy || '50');
        const feedbackCount = model.feedbackCount || 0;
        mlConfidence = Math.min(
          Math.round(30 + (modelAccuracy * 0.4) + Math.min(feedbackCount * 2, 20)),
          95
        );
        
        sourceLabel = 'ML-Enhanced';
      }
    } catch (err) {
      ML_LOGGER.error({ err, propertyId }, 'TensorFlow prediction failed, trying fallback');
      try {
        const nn = new SimpleNeuralNetwork(
          model.modelConfig as MLModelConfig,
          model.modelWeights as number[][]
        );
        mlScore = Math.round(nn.predict(featureVector));
        const modelAccuracy = parseFloat(model.trainingAccuracy || '50');
        const feedbackCount = model.feedbackCount || 0;
        mlConfidence = Math.min(
          Math.round(30 + (modelAccuracy * 0.4) + Math.min(feedbackCount * 2, 20)),
          95
        );
        sourceLabel = 'ML-Enhanced';
      } catch (fallbackErr) {
        logger.error({ fallbackErr, propertyId }, 'ML prediction fallback also failed');
      }
    }
  }
  
  let combinedScore = statisticalScore;
  let combinedConfidence = statisticalConfidence;
  
  if (mlScore !== null && mlConfidence !== null) {
    const statWeight = statisticalConfidence / (statisticalConfidence + mlConfidence);
    const mlWeight = mlConfidence / (statisticalConfidence + mlConfidence);
    combinedScore = Math.round(statisticalScore * statWeight + mlScore * mlWeight);
    combinedConfidence = Math.round((statisticalConfidence + mlConfidence) / 2);
  }
  
  let predictedDaysToBreach: number | null = null;
  let predictedBreachDate: Date | null = null;
  
  if (combinedScore >= 70) {
    predictedDaysToBreach = Math.max(1, Math.round((100 - combinedScore) * 3));
    predictedBreachDate = new Date();
    predictedBreachDate.setDate(predictedBreachDate.getDate() + predictedDaysToBreach);
  } else if (combinedScore >= 40) {
    predictedDaysToBreach = Math.round(30 + (100 - combinedScore) * 2);
    predictedBreachDate = new Date();
    predictedBreachDate.setDate(predictedBreachDate.getDate() + predictedDaysToBreach);
  }
  
  const riskCategory = combinedScore >= 85 ? 'CRITICAL' :
                       combinedScore >= 70 ? 'HIGH' :
                       combinedScore >= 40 ? 'MEDIUM' : 'LOW';

  if (model) {
    await db.insert(mlPredictions).values({
      organisationId,
      modelId: model.id,
      propertyId,
      predictionType: 'BREACH_PROBABILITY',
      statisticalScore,
      statisticalConfidence,
      mlScore,
      mlConfidence,
      predictedBreachDate,
      predictedDaysToBreach,
      predictedRiskCategory: riskCategory,
      inputFeatures,
      isTest,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }

  return {
    propertyId,
    predictionType: 'BREACH_PROBABILITY',
    statisticalScore,
    statisticalConfidence,
    mlScore,
    mlConfidence,
    predictedBreachDate,
    predictedDaysToBreach,
    predictedRiskCategory: riskCategory,
    inputFeatures,
    combinedScore,
    combinedConfidence,
    sourceLabel,
  };
}

export async function trainModelFromFeedback(
  organisationId: string,
  trainingConfig?: Partial<TrainingConfig>
): Promise<{
  success: boolean;
  modelId: string;
  accuracy: number;
  epochHistory: Array<{ epoch: number; loss: number; accuracy: number }>;
}> {
  const config = { ...DEFAULT_TRAINING_CONFIG, ...trainingConfig };
  
  const model = await getOrCreateModel(organisationId, 'BREACH_PROBABILITY');
  if (!model) {
    throw new Error('Failed to create or get model');
  }

  const [trainingRun] = await db.insert(mlTrainingRuns)
    .values({
      organisationId,
      modelId: model.id,
      status: 'TRAINING',
      learningRate: String(config.learningRate),
      epochs: config.epochs,
      batchSize: config.batchSize,
    })
    .returning();

  try {
    const predictions = await db.select()
      .from(mlPredictions)
      .innerJoin(mlFeedback, eq(mlPredictions.id, mlFeedback.predictionId))
      .where(and(
        eq(mlPredictions.organisationId, organisationId),
        eq(mlFeedback.usedForTraining, false)
      ))
      .limit(1000);

    const trainingData: { input: number[]; target: number }[] = [];
    
    for (const record of predictions) {
      const features = record.ml_predictions.inputFeatures as Record<string, number>;
      const feedback = record.ml_feedback;
      
      let targetScore: number;
      if (feedback.feedbackType === 'CORRECT') {
        targetScore = record.ml_predictions.statisticalScore || 50;
      } else if (feedback.correctedScore !== null) {
        targetScore = feedback.correctedScore;
      } else {
        continue;
      }
      
      const input = DEFAULT_MODEL_CONFIG.inputFeatures.map(
        feature => features[feature] || 0
      );
      
      trainingData.push({ input, target: targetScore });
    }

    if (trainingData.length < 10) {
      const allProperties = await db.select({ id: properties.id })
        .from(properties)
        .innerJoin(blocks, eq(properties.blockId, blocks.id))
        .innerJoin(schemes, eq(blocks.schemeId, schemes.id))
        .where(eq(schemes.organisationId, organisationId))
        .limit(100);

      for (const prop of allProperties) {
        const { score: statScore, riskData } = await calculateStatisticalPrediction(prop.id, organisationId);
        const features = await extractPropertyFeatures(prop.id, riskData);
        
        const input = DEFAULT_MODEL_CONFIG.inputFeatures.map(
          feature => features[feature] || 0
        );
        
        trainingData.push({ input, target: statScore });
      }
    }

    let result: { finalLoss: number; finalAccuracy: number; epochHistory: Array<{ epoch: number; loss: number; accuracy: number }> };
    let modelWeights: TensorFlowWeightFormat[] | number[][];

    try {
      ML_LOGGER.info({ samples: trainingData.length }, 'Starting TensorFlow training');
      const tfModel = new TensorFlowModel(DEFAULT_MODEL_CONFIG);
      
      if (model.modelWeights && isNewWeightFormat(model.modelWeights)) {
        tfModel.loadWeights(model.modelWeights);
      }
      
      result = await tfModel.train(trainingData, config, async (epoch, loss, accuracy) => {
        await db.update(mlTrainingRuns)
          .set({
            currentEpoch: epoch,
            trainingProgress: Math.round((epoch / config.epochs) * 100),
          })
          .where(eq(mlTrainingRuns.id, trainingRun.id));
      });
      
      modelWeights = tfModel.getWeightsWithShapes();
      ML_LOGGER.info({ accuracy: result.finalAccuracy }, 'TensorFlow training completed');
    } catch (tfError) {
      ML_LOGGER.warn({ tfError }, 'TensorFlow training failed, falling back to SimpleNeuralNetwork');
      
      const nn = new SimpleNeuralNetwork(DEFAULT_MODEL_CONFIG, model.modelWeights as number[][] | undefined);
      
      result = nn.train(trainingData, config, async (epoch, loss, accuracy) => {
        await db.update(mlTrainingRuns)
          .set({
            currentEpoch: epoch,
            trainingProgress: Math.round((epoch / config.epochs) * 100),
          })
          .where(eq(mlTrainingRuns.id, trainingRun.id));
      });
      
      modelWeights = nn.getWeights();
    }

    cachedTensorFlowModel = null;
    cachedTensorFlowModelId = null;

    await db.update(mlModels)
      .set({
        modelWeights: modelWeights as any,
        status: 'ACTIVE',
        trainingAccuracy: String(result.finalAccuracy.toFixed(2)),
        trainingLoss: String(result.finalLoss.toFixed(4)),
        trainingProgress: 100,
        trainingSamples: trainingData.length,
        lastTrainedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mlModels.id, model.id));

    await db.update(mlTrainingRuns)
      .set({
        status: 'ACTIVE',
        trainingProgress: 100,
        trainingSamples: trainingData.length,
        finalAccuracy: String(result.finalAccuracy.toFixed(2)),
        finalLoss: String(result.finalLoss.toFixed(4)),
        epochHistory: result.epochHistory,
        completedAt: new Date(),
      })
      .where(eq(mlTrainingRuns.id, trainingRun.id));

    if (predictions.length > 0) {
      for (const pred of predictions) {
        await db.update(mlFeedback)
          .set({
            usedForTraining: true,
            trainingBatchId: trainingRun.id,
          })
          .where(eq(mlFeedback.id, pred.ml_feedback.id));
      }
    }

    logger.info({ modelId: model.id, accuracy: result.finalAccuracy, samples: trainingData.length }, 'ML model training completed');

    return {
      success: true,
      modelId: model.id,
      accuracy: result.finalAccuracy,
      epochHistory: result.epochHistory,
    };
  } catch (error) {
    await db.update(mlTrainingRuns)
      .set({
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(mlTrainingRuns.id, trainingRun.id));

    logger.error({ err: error, organisationId }, 'ML model training failed');
    throw error;
  }
}

export async function submitPredictionFeedback(
  predictionId: string,
  organisationId: string,
  feedbackType: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT',
  submittedById?: string,
  submittedByName?: string,
  correctedScore?: number,
  correctedCategory?: string,
  feedbackNotes?: string
): Promise<typeof mlFeedback.$inferSelect> {
  const [feedback] = await db.insert(mlFeedback)
    .values({
      organisationId,
      predictionId,
      feedbackType,
      submittedById,
      submittedByName,
      correctedScore,
      correctedCategory,
      feedbackNotes,
    })
    .returning();

  const model = await db.select()
    .from(mlPredictions)
    .innerJoin(mlModels, eq(mlPredictions.modelId, mlModels.id))
    .where(eq(mlPredictions.id, predictionId))
    .limit(1);

  if (model.length > 0) {
    await db.update(mlModels)
      .set({
        feedbackCount: sql`${mlModels.feedbackCount} + 1`,
        correctPredictions: feedbackType === 'CORRECT' 
          ? sql`${mlModels.correctPredictions} + 1` 
          : mlModels.correctPredictions,
        updatedAt: new Date(),
      })
      .where(eq(mlModels.id, model[0].ml_models.id));
  }

  return feedback;
}

export async function getModelMetrics(organisationId: string): Promise<{
  model: {
    accuracy: number | null;
    totalPredictions: number;
    correctPredictions: number;
    trainingAccuracy: string | null;
    status: string;
  } | null;
  feedbackStats: {
    total: number;
    correct: number;
    incorrect: number;
  };
  trainingReady: boolean;
  recentTrainingRuns: Array<typeof mlTrainingRuns.$inferSelect>;
}> {
  const modelData = await getOrCreateModel(organisationId);
  
  if (!modelData) {
    return {
      model: null,
      feedbackStats: { total: 0, correct: 0, incorrect: 0 },
      trainingReady: false,
      recentTrainingRuns: [],
    };
  }

  const predictions = await db.select({ count: count() })
    .from(mlPredictions)
    .where(eq(mlPredictions.modelId, modelData.id));

  const totalPredictions = predictions[0]?.count || 0;

  const correctFeedbacks = await db.select({ count: count() })
    .from(mlFeedback)
    .innerJoin(mlPredictions, eq(mlFeedback.predictionId, mlPredictions.id))
    .where(and(
      eq(mlPredictions.modelId, modelData.id),
      eq(mlFeedback.feedbackType, 'CORRECT')
    ));

  const incorrectFeedbacks = await db.select({ count: count() })
    .from(mlFeedback)
    .innerJoin(mlPredictions, eq(mlFeedback.predictionId, mlPredictions.id))
    .where(and(
      eq(mlPredictions.modelId, modelData.id),
      eq(mlFeedback.feedbackType, 'INCORRECT')
    ));

  const trainingRuns = await db.select()
    .from(mlTrainingRuns)
    .where(eq(mlTrainingRuns.modelId, modelData.id))
    .orderBy(desc(mlTrainingRuns.startedAt))
    .limit(10);

  const correctCount = correctFeedbacks[0]?.count || 0;
  const incorrectCount = incorrectFeedbacks[0]?.count || 0;
  const totalFeedback = correctCount + incorrectCount;
  
  const accuracy = totalFeedback > 0 
    ? correctCount / totalFeedback 
    : (modelData.trainingAccuracy ? parseFloat(modelData.trainingAccuracy) / 100 : null);

  return {
    model: {
      accuracy,
      totalPredictions,
      correctPredictions: correctCount,
      trainingAccuracy: modelData.trainingAccuracy,
      status: modelData.status,
    },
    feedbackStats: {
      total: totalFeedback,
      correct: correctCount,
      incorrect: incorrectCount,
    },
    trainingReady: totalFeedback >= 10,
    recentTrainingRuns: trainingRuns,
  };
}

export async function updateModelSettings(
  organisationId: string,
  settings: {
    learningRate?: string;
    epochs?: number;
    batchSize?: number;
    featureWeights?: Record<string, number>;
  }
): Promise<typeof mlModels.$inferSelect | null> {
  const model = await getOrCreateModel(organisationId);
  if (!model) return null;

  const [updated] = await db.update(mlModels)
    .set({
      ...settings,
      updatedAt: new Date(),
    })
    .where(eq(mlModels.id, model.id))
    .returning();

  return updated;
}
