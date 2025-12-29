import { EvidenceData, StreamScore } from '@/lib/risk/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'wouter';
import { 
  X, 
  Download, 
  ExternalLink, 
  Building2, 
  Users, 
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface EvidencePanelProps {
  evidence: EvidenceData | null;
  onClose: () => void;
  onExport?: (type: 'pdf' | 'excel' | 'both') => void;
}

function StreamComplianceRow({ stream, onNavigate }: { stream: StreamScore; onNavigate: (stream: string, status: string) => void }) {
  const percentage = Math.round(stream.compliance * 100);
  const gap = 100 - percentage;
  
  const streamLabels: Record<string, string> = {
    gas: 'Gas Safety',
    electrical: 'EICR',
    fire: 'FRA',
    asbestos: 'Asbestos',
    lift: 'Lifts',
    water: 'Water',
  };

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate(stream.stream, 'overdue')}>
      <TableCell className="font-medium">{streamLabels[stream.stream] || stream.stream}</TableCell>
      <TableCell className="text-center">100%</TableCell>
      <TableCell className="text-center">
        <span className={percentage < 90 ? 'text-red-600 font-medium' : percentage < 98 ? 'text-amber-600' : 'text-green-600'}>
          {percentage}%
        </span>
      </TableCell>
      <TableCell className="text-center">
        {gap > 0 ? (
          <span className="text-red-600">-{gap.toFixed(1)}%</span>
        ) : (
          <span className="text-green-600">0%</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {stream.overdueCount > 0 ? (
          <Badge variant="destructive" className="text-xs">({stream.overdueCount})</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function FindingRow({ finding, onViewCertificate }: { finding: EvidenceData['findings'][0]; onViewCertificate: (id: string) => void }) {
  const severityColors = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    major: 'text-amber-600 bg-amber-50 border-amber-200',
    minor: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onViewCertificate(finding.certificateId)}>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${severityColors[finding.severity]}`}>
          {finding.ref}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">{finding.type}</TableCell>
      <TableCell className="text-sm">{finding.propertyName}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{finding.age}d</TableCell>
      <TableCell>
        {finding.dueIn <= 0 ? (
          <Badge variant="destructive" className="text-xs">NOW</Badge>
        ) : finding.dueIn <= 7 ? (
          <Badge variant="destructive" className="text-xs">{finding.dueIn} days</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{finding.dueIn} days</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function EvidencePanel({ evidence, onClose, onExport }: EvidencePanelProps) {
  if (!evidence) {
    return (
      <Card className="h-full flex flex-col" data-testid="evidence-panel-empty">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Evidence View</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            Select an area on the map to view compliance evidence
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleNavigate = (stream: string, status: string) => {
    window.location.href = `/certificates?stream=${stream}&status=${status}&area=${evidence.area.id}`;
  };

  const handleViewCertificate = (certificateId: string) => {
    window.location.href = `/certificates/${certificateId}`;
  };

  const levelLabels = { property: 'Property', estate: 'Estate', ward: 'Ward' };

  return (
    <Card className="h-full flex flex-col" data-testid="evidence-panel">
      <CardHeader className="flex-shrink-0 pb-3 border-b">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-bold uppercase tracking-wide">{evidence.area.name}</div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {evidence.summary.blockCount} blocks
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {evidence.summary.unitCount} units
              </span>
              {evidence.summary.hrbCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {evidence.summary.hrbCount} HRBs
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
                Compliance Coverage
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stream</TableHead>
                    <TableHead className="text-center">Target</TableHead>
                    <TableHead className="text-center">Actual</TableHead>
                    <TableHead className="text-center">Gap</TableHead>
                    <TableHead className="text-center">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidence.streams.map(stream => (
                    <StreamComplianceRow 
                      key={stream.stream} 
                      stream={stream} 
                      onNavigate={handleNavigate}
                    />
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Click any row to see certificates
              </p>
            </div>

            {evidence.findings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  High-Severity Findings ({evidence.findings.filter(f => f.severity === 'critical' || f.severity === 'major').length})
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.findings
                      .filter(f => f.severity === 'critical' || f.severity === 'major')
                      .slice(0, 10)
                      .map(finding => (
                        <FindingRow 
                          key={finding.id} 
                          finding={finding} 
                          onViewCertificate={handleViewCertificate}
                        />
                      ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Click any row to view certificate
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4 border-t">
              <Link href={`/certificates?area=${evidence.area.id}`}>
                <Button variant="outline" className="w-full" data-testid="button-view-all-certificates">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Certificates
                </Button>
              </Link>
              {onExport && (
                <Button variant="default" className="w-full" onClick={() => onExport('pdf')} data-testid="button-download-evidence">
                  <Download className="h-4 w-4 mr-2" />
                  Download Evidence Pack
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default EvidencePanel;
