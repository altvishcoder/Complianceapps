import {
  Flame,
  Zap,
  Leaf,
  Droplets,
  AlertTriangle,
  Building2,
  Building,
  ArrowUpDown,
  TreePine,
  ShieldCheck,
  Home,
  Accessibility,
  Bug,
  Trash2,
  Users,
  FileText,
  HeartPulse,
  Lock,
  Lightbulb,
  Shield,
  type LucideIcon,
} from 'lucide-react';

export interface ComplianceStreamConfig {
  code: string;
  name: string;
  icon: LucideIcon;
  iconName: string;
  color: string;
}

export const COMPLIANCE_STREAM_ICONS: Record<string, LucideIcon> = {
  Flame,
  Zap,
  Leaf,
  Droplets,
  AlertTriangle,
  Building2,
  Building,
  ArrowUpDown,
  TreePine,
  ShieldCheck,
  Shield,
  Home,
  Accessibility,
  Bug,
  Trash2,
  Users,
  FileText,
  HeartPulse,
  Lock,
  Lightbulb,
  FireExtinguisher: Flame,
};

export const COMPLIANCE_STREAMS: Record<string, ComplianceStreamConfig> = {
  GAS_HEATING: {
    code: 'GAS_HEATING',
    name: 'Gas & Heating Safety',
    icon: Flame,
    iconName: 'Flame',
    color: '#EF4444',
  },
  ELECTRICAL: {
    code: 'ELECTRICAL',
    name: 'Electrical Safety',
    icon: Zap,
    iconName: 'Zap',
    color: '#F59E0B',
  },
  ENERGY: {
    code: 'ENERGY',
    name: 'Energy & Efficiency',
    icon: Leaf,
    iconName: 'Leaf',
    color: '#22C55E',
  },
  FIRE_SAFETY: {
    code: 'FIRE_SAFETY',
    name: 'Fire Safety',
    icon: Flame,
    iconName: 'FireExtinguisher',
    color: '#DC2626',
  },
  ASBESTOS: {
    code: 'ASBESTOS',
    name: 'Asbestos Management',
    icon: AlertTriangle,
    iconName: 'AlertTriangle',
    color: '#7C3AED',
  },
  WATER_SAFETY: {
    code: 'WATER_SAFETY',
    name: 'Water Safety & Legionella',
    icon: Droplets,
    iconName: 'Droplets',
    color: '#0EA5E9',
  },
  LIFTING: {
    code: 'LIFTING',
    name: 'Lifting Equipment',
    icon: ArrowUpDown,
    iconName: 'ArrowUpDown',
    color: '#6366F1',
  },
  LIFT_EQUIPMENT: {
    code: 'LIFT_EQUIPMENT',
    name: 'Lifting Equipment',
    icon: ArrowUpDown,
    iconName: 'ArrowUpDown',
    color: '#06B6D4',
  },
  BUILDING_SAFETY: {
    code: 'BUILDING_SAFETY',
    name: 'Building & Structural Safety',
    icon: Building2,
    iconName: 'Building2',
    color: '#78716C',
  },
  EXTERNAL: {
    code: 'EXTERNAL',
    name: 'External Areas & Grounds',
    icon: TreePine,
    iconName: 'TreePine',
    color: '#84CC16',
  },
  SECURITY: {
    code: 'SECURITY',
    name: 'Security & Access',
    icon: ShieldCheck,
    iconName: 'ShieldCheck',
    color: '#0F172A',
  },
  HRB_SPECIFIC: {
    code: 'HRB_SPECIFIC',
    name: 'Higher-Risk Buildings (HRB)',
    icon: Building,
    iconName: 'Building',
    color: '#B91C1C',
  },
  HOUSING_HEALTH: {
    code: 'HOUSING_HEALTH',
    name: 'Housing Health & Safety',
    icon: Home,
    iconName: 'Home',
    color: '#0D9488',
  },
  ACCESSIBILITY: {
    code: 'ACCESSIBILITY',
    name: 'Accessibility & Adaptations',
    icon: Accessibility,
    iconName: 'Accessibility',
    color: '#8B5CF6',
  },
  PEST_CONTROL: {
    code: 'PEST_CONTROL',
    name: 'Pest Control',
    icon: Bug,
    iconName: 'Bug',
    color: '#A3A3A3',
  },
  WASTE: {
    code: 'WASTE',
    name: 'Waste Management',
    icon: Trash2,
    iconName: 'Trash2',
    color: '#65A30D',
  },
  COMMUNAL: {
    code: 'COMMUNAL',
    name: 'Communal Areas',
    icon: Users,
    iconName: 'Users',
    color: '#EC4899',
  },
};

export function getStreamIcon(streamCode: string): LucideIcon {
  return COMPLIANCE_STREAMS[streamCode]?.icon || FileText;
}

export function getStreamColor(streamCode: string): string {
  return COMPLIANCE_STREAMS[streamCode]?.color || '#6B7280';
}

export function getStreamConfig(streamCode: string): ComplianceStreamConfig | undefined {
  return COMPLIANCE_STREAMS[streamCode];
}

export function getIconByName(iconName: string): LucideIcon {
  return COMPLIANCE_STREAM_ICONS[iconName] || FileText;
}
