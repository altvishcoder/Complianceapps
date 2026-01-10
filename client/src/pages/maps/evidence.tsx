import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MapWrapper, BaseMap, PropertyMarkers, RiskLegend } from '@/components/maps';
import { EvidencePanel } from '@/components/maps/EvidencePanel';
import { BoardMode } from '@/components/maps/BoardMode';
import type { PropertyMarker } from '@/components/maps';
import type { EvidenceData } from '@/lib/risk/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getIcon, getActionIcon } from '@/config/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextBackButton } from '@/components/navigation/ContextBackButton';

const Download = getActionIcon('download');
const Building2 = getIcon('Building2');
const FileText = getIcon('FileText');
const HelpCircle = getIcon('HelpCircle');

function hasUrlFilters(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('from');
}

const REGULATOR_QUESTIONS = [
  { id: 'highest-risk', label: 'Show highest residual risks', filter: { maxScore: 70 } },
  { id: 'finding-age', label: 'How long have findings been open?', sort: 'age' },
  { id: 'hrb-status', label: 'HRB compliance status?', filter: { hrb: true } },
  { id: 'overdue', label: 'What is overdue?', filter: { status: 'overdue' } },
];

function generateSampleEvidence(areaId: string, areaName: string): EvidenceData {
  return {
    area: { id: areaId, name: areaName, level: 'estate' },
    summary: {
      compliance: 94.1,
      openHighSeverity: 4,
      avgFindingAge: 8,
      hrbCount: 3,
      blockCount: 12,
      unitCount: 847,
    },
    streams: [
      { stream: 'gas', compliance: 0.982, total: 100, compliant: 98, overdueCount: 2, dueSoonCount: 15 },
      { stream: 'electrical', compliance: 0.941, total: 100, compliant: 94, overdueCount: 6, dueSoonCount: 47 },
      { stream: 'fire', compliance: 1.0, total: 50, compliant: 50, overdueCount: 0, dueSoonCount: 5 },
      { stream: 'asbestos', compliance: 0.973, total: 80, compliant: 78, overdueCount: 2, dueSoonCount: 22 },
      { stream: 'lift', compliance: 0.875, total: 8, compliant: 7, overdueCount: 1, dueSoonCount: 1 },
      { stream: 'water', compliance: 0.912, total: 60, compliant: 55, overdueCount: 5, dueSoonCount: 7 },
    ],
    findings: [
      { id: 'f1', ref: 'RA-123', type: 'C2', severity: 'major', propertyName: 'Block A #12', age: 12, dueIn: 7, certificateId: 'cert-1' },
      { id: 'f2', ref: 'RA-124', type: 'ID', severity: 'critical', propertyName: 'Block C #45', age: 2, dueIn: 0, certificateId: 'cert-2' },
      { id: 'f3', ref: 'RA-125', type: 'C2', severity: 'major', propertyName: 'Block A #8', age: 8, dueIn: 14, certificateId: 'cert-3' },
      { id: 'f4', ref: 'RA-126', type: 'C1', severity: 'critical', propertyName: 'Block D #3', age: 1, dueIn: 0, certificateId: 'cert-4' },
    ],
    certificateLinks: [],
  };
}

function generateEvidenceMarkers(): PropertyMarker[] {
  return [
    { id: 'e1', name: 'Highgate Estate', lat: 51.574, lng: -0.144, riskScore: 82, propertyCount: 12, unitCount: 847 },
    { id: 'e2', name: 'Camden Gardens', lat: 51.557, lng: -0.178, riskScore: 75, propertyCount: 8, unitCount: 420 },
    { id: 'e3', name: 'Islington Heights', lat: 51.536, lng: -0.103, riskScore: 68, propertyCount: 15, unitCount: 1120 },
    { id: 'e4', name: 'Hackney Central Estate', lat: 51.545, lng: -0.055, riskScore: 55, propertyCount: 22, unitCount: 890 },
    { id: 'e5', name: 'Bethnal Green Towers', lat: 51.527, lng: -0.055, riskScore: 88, propertyCount: 6, unitCount: 340 },
    { id: 'e6', name: 'Mile End Estate', lat: 51.525, lng: -0.034, riskScore: 72, propertyCount: 18, unitCount: 780 },
    { id: 'e7', name: 'Whitechapel Houses', lat: 51.519, lng: -0.061, riskScore: 91, propertyCount: 10, unitCount: 520 },
    { id: 'e8', name: 'Bermondsey Estate', lat: 51.499, lng: -0.063, riskScore: 65, propertyCount: 14, unitCount: 680 },
  ];
}

export default function EvidencePage() {
  const [boardMode, setBoardMode] = useState(false);
  const [hrbOnly, setHrbOnly] = useState(false);
  const [selectedArea, setSelectedArea] = useState<PropertyMarker | null>(null);
  const showBackButton = useMemo(() => hasUrlFilters(), []);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const sampleMarkers = useMemo(() => generateEvidenceMarkers(), []);
  
  const { data: apiMarkers = sampleMarkers } = useQuery({
    queryKey: ['evidence-markers'],
    queryFn: async () => {
      const userId = localStorage.getItem('user_id');
      const res = await fetch('/api/properties/geo', {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) return sampleMarkers;
      const data = await res.json();
      return data.length > 0 ? data : sampleMarkers;
    },
    staleTime: 30000,
  });
  
  const markers = useMemo(() => {
    let data = apiMarkers;
    if (hrbOnly) {
      data = data.filter((m: PropertyMarker) => m.unitCount && m.unitCount > 500);
    }
    if (selectedQuestion === 'highest-risk') {
      data = data.filter((m: PropertyMarker) => m.riskScore < 70);
    }
    return data;
  }, [apiMarkers, hrbOnly, selectedQuestion]);

  const { data: evidence } = useQuery({
    queryKey: ['evidence-data', selectedArea?.id],
    queryFn: async () => {
      if (!selectedArea) return null;
      const isSampleData = selectedArea.id.startsWith('e') || selectedArea.id.startsWith('prop-');
      if (isSampleData) {
        return generateSampleEvidence(selectedArea.id, selectedArea.name);
      }
      
      const userId = localStorage.getItem('user_id');
      const res = await fetch(`/api/risk/evidence/${selectedArea.id}`, {
        headers: { 'X-User-Id': userId || '' }
      });
      if (!res.ok) {
        return generateSampleEvidence(selectedArea.id, selectedArea.name);
      }
      
      const data = await res.json();
      return {
        area: { id: selectedArea.id, name: data.property?.addressLine1 || selectedArea.name, level: 'property' as const },
        summary: {
          compliance: data.riskScore || 0,
          openHighSeverity: data.actions?.filter((a: any) => a.severity === 'IMMEDIATE' || a.severity === 'URGENT').length || 0,
          avgFindingAge: 0,
          hrbCount: 0,
          blockCount: 1,
          unitCount: 1,
        },
        streams: [
          { stream: 'gas' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'GAS_SAFETY').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
          { stream: 'electrical' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'EICR').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
          { stream: 'fire' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'FIRE_RISK_ASSESSMENT').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
          { stream: 'asbestos' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'ASBESTOS_SURVEY').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
          { stream: 'lift' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'LIFT_LOLER').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
          { stream: 'water' as const, compliance: 0, total: data.certificates?.filter((c: any) => c.certificateType === 'LEGIONELLA_ASSESSMENT').length || 0, compliant: 0, overdueCount: 0, dueSoonCount: 0 },
        ],
        findings: (data.actions || []).map((a: any, i: number) => ({
          id: a.id || `f${i}`,
          ref: a.reference || `RA-${i}`,
          type: a.code || 'Unknown',
          severity: a.severity?.toLowerCase() || 'minor',
          propertyName: data.property?.addressLine1 || 'Unknown',
          age: 0,
          dueIn: 0,
          certificateId: a.certificateId || '',
        })),
        certificateLinks: (data.certificates || []).map((c: any) => ({
          id: c.id,
          type: c.certificateType,
          status: c.status,
          expiryDate: c.expiryDate,
        })),
      };
    },
    enabled: !!selectedArea,
    staleTime: 30000,
  });

  const handleAreaClick = (marker: PropertyMarker) => {
    setSelectedArea(marker);
  };

  const handleExport = (type: 'pdf' | 'excel' | 'both') => {
    console.log('Export evidence pack:', type);
  };

  const handleQuestionClick = (questionId: string) => {
    setSelectedQuestion(questionId === selectedQuestion ? null : questionId);
  };

  if (boardMode) {
    return (
      <div className="flex h-screen bg-muted/30">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Evidence View" />
          <main id="main-content" className="flex-1 overflow-y-auto" role="main" aria-label="Board mode evidence content">
            {showBackButton && (
              <div className="p-4 pb-0">
                <ContextBackButton fallbackPath="/maps" fallbackLabel="Risk Maps" />
              </div>
            )}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">Board Mode</Badge>
                <span className="text-sm text-muted-foreground">Simplified view for non-technical board members</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="board-mode" checked={boardMode} onCheckedChange={setBoardMode} />
                <Label htmlFor="board-mode">Board Mode</Label>
              </div>
            </div>
            <BoardMode
              organisationName="Acme Housing Association"
              overallScore={94}
              targetScore={100}
              openHighSeverity={4}
              trend="improving"
              trendPercentage={3}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Evidence View" />
        <main id="main-content" className="flex-1 overflow-hidden flex flex-col" role="main" aria-label="Evidence view content">
          {showBackButton && (
            <div className="p-4 pb-0">
              <ContextBackButton fallbackPath="/maps" fallbackLabel="Risk Maps" />
            </div>
          )}
          <div className="p-4 border-b bg-background flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="hrb-only" checked={hrbOnly} onCheckedChange={setHrbOnly} data-testid="switch-hrb-only" />
                <Label htmlFor="hrb-only" className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  HRB Only
                </Label>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-quick-questions">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Quick Questions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {REGULATOR_QUESTIONS.map(q => (
                    <DropdownMenuItem 
                      key={q.id} 
                      onClick={() => handleQuestionClick(q.id)}
                      className={selectedQuestion === q.id ? 'bg-muted' : ''}
                    >
                      {q.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedQuestion && (
                <Badge variant="secondary" className="text-xs">
                  Filter: {REGULATOR_QUESTIONS.find(q => q.id === selectedQuestion)?.label}
                  <button 
                    className="ml-2 hover:text-destructive" 
                    onClick={() => setSelectedQuestion(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="board-mode" checked={boardMode} onCheckedChange={setBoardMode} data-testid="switch-board-mode" />
                <Label htmlFor="board-mode">Board Mode</Label>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export-menu">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Board Summary (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Full Pack (Excel)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('both')}>
                    <Download className="h-4 w-4 mr-2" />
                    Regulator Submission (ZIP)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative">
              <MapWrapper>
                <BaseMap center={[51.535, -0.09]} zoom={12}>
                  <PropertyMarkers 
                    properties={markers}
                    onPropertyClick={handleAreaClick}
                  />
                </BaseMap>
              </MapWrapper>
              
              <div className="absolute bottom-4 left-4 z-[1000]">
                <RiskLegend />
              </div>
              
              {!selectedArea && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-muted-foreground">
                    Click an estate to see evidence
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-96 border-l bg-background overflow-hidden">
              <EvidencePanel
                evidence={evidence ?? null}
                onClose={() => setSelectedArea(null)}
                onExport={handleExport}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
