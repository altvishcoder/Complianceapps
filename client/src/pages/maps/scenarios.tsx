import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend } from '@/components/maps';
import { ScenarioPanel } from '@/components/maps/ScenarioPanel';
import { ScenarioImpact } from '@/components/maps/ScenarioImpact';
import type { PropertyMarker } from '@/components/maps';
import type { Scenario, ScenarioResult, ScenarioType } from '@/lib/risk/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, AlertTriangle } from 'lucide-react';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from');
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { type: 'advisory_as_failure', enabled: false, params: {} },
  { type: 'certificate_slip', enabled: false, params: { slipPercentage: 20 } },
  { type: 'dual_failure', enabled: false, params: {} },
  { type: 'capacity_reduction', enabled: false, params: { capacityReduction: 25 } },
  { type: 'hrb_only', enabled: false, params: {} },
];

function generateScenarioResult(scenarios: Scenario[]): ScenarioResult | null {
  const enabledScenarios = scenarios.filter(s => s.enabled);
  if (enabledScenarios.length === 0) return null;

  const baselineScore = 78;
  const baselineAtRisk = 23;
  
  let scoreReduction = 0;
  let additionalAtRisk = 0;

  for (const scenario of enabledScenarios) {
    switch (scenario.type) {
      case 'advisory_as_failure':
        scoreReduction += 8;
        additionalAtRisk += 12;
        break;
      case 'certificate_slip':
        const slipPct = scenario.params.slipPercentage || 20;
        scoreReduction += Math.floor(slipPct / 2);
        additionalAtRisk += Math.floor(slipPct * 1.5);
        break;
      case 'dual_failure':
        scoreReduction += 5;
        additionalAtRisk += 8;
        break;
      case 'capacity_reduction':
        const capPct = scenario.params.capacityReduction || 25;
        scoreReduction += Math.floor(capPct / 3);
        additionalAtRisk += Math.floor(capPct / 2);
        break;
      case 'hrb_only':
        break;
    }
  }

  const scenarioScore = Math.max(0, baselineScore - scoreReduction);
  const scenarioAtRisk = baselineAtRisk + additionalAtRisk;

  return {
    baseline: { score: baselineScore, propertiesAtRisk: baselineAtRisk },
    scenario: { score: scenarioScore, propertiesAtRisk: scenarioAtRisk },
    impact: {
      scoreChange: -scoreReduction,
      additionalAtRisk,
      newHotspots: additionalAtRisk > 0 ? [
        { id: 'h1', name: 'Highgate Block C', baselineScore: 72, scenarioScore: Math.max(0, 72 - scoreReduction) },
        { id: 'h2', name: 'Camden Estate Tower', baselineScore: 68, scenarioScore: Math.max(0, 68 - scoreReduction) },
        { id: 'h3', name: 'Islington Heights', baselineScore: 75, scenarioScore: Math.max(0, 75 - scoreReduction) },
      ] : [],
    },
    affectedAreas: [],
  };
}

function generateScenarioMarkers(scenarios: Scenario[]): PropertyMarker[] {
  const baseMarkers: PropertyMarker[] = [
    { id: 's1', name: 'Westminster Estate', lat: 51.501, lng: -0.141, riskScore: 82, propertyCount: 45, unitCount: 320 },
    { id: 's2', name: 'Camden Heights', lat: 51.539, lng: -0.142, riskScore: 75, propertyCount: 38, unitCount: 280 },
    { id: 's3', name: 'Islington Park', lat: 51.536, lng: -0.103, riskScore: 68, propertyCount: 52, unitCount: 410 },
    { id: 's4', name: 'Hackney Central', lat: 51.545, lng: -0.055, riskScore: 55, propertyCount: 28, unitCount: 190 },
    { id: 's5', name: 'Tower Hamlets Block', lat: 51.515, lng: -0.032, riskScore: 88, propertyCount: 62, unitCount: 480 },
    { id: 's6', name: 'Southwark Estate', lat: 51.473, lng: -0.080, riskScore: 72, propertyCount: 35, unitCount: 250 },
    { id: 's7', name: 'Lambeth Towers', lat: 51.457, lng: -0.123, riskScore: 65, propertyCount: 48, unitCount: 360 },
    { id: 's8', name: 'Wandsworth Green', lat: 51.456, lng: -0.191, riskScore: 91, propertyCount: 22, unitCount: 140 },
  ];

  const enabledScenarios = scenarios.filter(s => s.enabled);
  if (enabledScenarios.length === 0) return baseMarkers;

  let scoreReduction = 0;
  for (const scenario of enabledScenarios) {
    switch (scenario.type) {
      case 'advisory_as_failure':
        scoreReduction += 8;
        break;
      case 'certificate_slip':
        scoreReduction += Math.floor((scenario.params.slipPercentage || 20) / 2);
        break;
      case 'dual_failure':
        scoreReduction += 5;
        break;
      case 'capacity_reduction':
        scoreReduction += Math.floor((scenario.params.capacityReduction || 25) / 3);
        break;
    }
  }

  return baseMarkers.map(m => ({
    ...m,
    riskScore: Math.max(0, m.riskScore - scoreReduction),
  }));
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  
  const enabledCount = scenarios.filter(s => s.enabled).length;
  const isScenarioActive = enabledCount > 0;
  const showBackButton = useMemo(() => hasUrlFilters(), []);

  const scenarioResult = useMemo(() => generateScenarioResult(scenarios), [scenarios]);
  const markers = useMemo(() => generateScenarioMarkers(scenarios), [scenarios]);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Scenario Analysis" />
        <main id="main-content" className="flex-1 overflow-hidden flex flex-col" role="main" aria-label="Scenario analysis content">
          {showBackButton && (
            <div className="p-4 pb-0 border-b">
              <ContextBackButton fallbackPath="/maps" fallbackLabel="Risk Maps" />
            </div>
          )}
          <div className="flex-1 overflow-hidden flex">
          <div className="w-80 border-r bg-background overflow-y-auto">
            <ScenarioPanel scenarios={scenarios} onChange={setScenarios} />
          </div>
          
          <div className="flex-1 relative">
            {isScenarioActive && (
              <div className="absolute top-0 left-0 right-0 z-[1001] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">SCENARIO MODE - Showing hypothetical risk</span>
              </div>
            )}
            
            <div className={`h-full ${isScenarioActive ? 'pt-10' : ''}`}>
              <MapWrapper>
                <BaseMap center={[51.515, -0.09]} zoom={12}>
                  <PropertyMarkers properties={markers} />
                </BaseMap>
              </MapWrapper>
            </div>
            
            <div className="absolute bottom-4 left-4 z-[1000]">
              <RiskLegend />
            </div>
            
            <div className="absolute bottom-4 right-4 z-[1000]">
              <Button variant="secondary" size="sm" data-testid="button-download-report">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
          
          <div className="w-80 border-l bg-background overflow-y-auto">
            <ScenarioImpact result={scenarioResult} />
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
