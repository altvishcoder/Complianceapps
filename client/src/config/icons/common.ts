import {
  Home,
  Building,
  Building2,
  MapPin,
  FileText,
  FileCheck,
  FileClock,
  FileWarning,
  FileX,
  FolderTree,
  Package,
  Users,
  User,
  UserCheck,
  Settings,
  Wrench,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  CalendarCheck,
  CalendarX,
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  Filter,
  Plus,
  Minus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Menu,
  X,
  MoreHorizontal,
  MoreVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  Mail,
  Phone,
  MapPinned,
  Navigation,
  Layers,
  Grid3X3,
  List,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

export const NAVIGATION_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  overview: BarChart3,
  analytics: PieChart,
  properties: Building2,
  schemes: MapPin,
  blocks: Building,
  dwellings: Home,
  spaces: FolderTree,
  components: Package,
  certificates: FileText,
  actions: Wrench,
  calendar: Calendar,
  users: Users,
  settings: Settings,
  reports: BarChart3,
  riskRadar: Activity,
  maps: MapPinned,
  contractors: Users,
  hierarchy: Layers,
};

export const STATUS_ICONS: Record<string, LucideIcon> = {
  compliant: CheckCircle2,
  approved: CheckCircle2,
  valid: CheckCircle2,
  active: CheckCircle2,
  nonCompliant: XCircle,
  failed: XCircle,
  rejected: XCircle,
  expired: FileX,
  overdue: AlertCircle,
  expiringSoon: FileClock,
  pending: Clock,
  inProgress: RefreshCw,
  warning: AlertTriangle,
  error: AlertCircle,
  info: AlertCircle,
  unknown: AlertCircle,
};

export const ACTION_ICONS: Record<string, LucideIcon> = {
  add: Plus,
  create: Plus,
  edit: Edit,
  delete: Trash2,
  remove: Minus,
  view: Eye,
  hide: EyeOff,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  expand: ChevronDown,
  collapse: ChevronUp,
  next: ChevronRight,
  previous: ChevronLeft,
  menu: Menu,
  close: X,
  more: MoreHorizontal,
  moreVertical: MoreVertical,
  lock: Lock,
  unlock: Unlock,
};

export const HIERARCHY_ICONS: Record<string, LucideIcon> = {
  scheme: MapPin,
  block: Building,
  property: Home,
  dwelling: Home,
  space: FolderTree,
  component: Package,
  certificate: FileText,
  stream: Layers,
  certificateType: FileText,
};

export const HIERARCHY_COLORS: Record<string, string> = {
  scheme: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  block: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  property: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  dwelling: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  space: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
  component: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300',
  stream: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  certificateType: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
};

export function getNavigationIcon(key: string): LucideIcon {
  return NAVIGATION_ICONS[key] || LayoutDashboard;
}

export function getStatusIcon(status: string): LucideIcon {
  const statusMap: Record<string, keyof typeof STATUS_ICONS> = {
    'compliant': 'compliant',
    'approved': 'approved',
    'valid': 'valid',
    'active': 'active',
    'non_compliant': 'nonCompliant',
    'noncompliant': 'nonCompliant',
    'failed': 'failed',
    'rejected': 'rejected',
    'expired': 'expired',
    'overdue': 'overdue',
    'expiring_soon': 'expiringSoon',
    'expiringsoon': 'expiringSoon',
    'pending': 'pending',
    'in_progress': 'inProgress',
    'inprogress': 'inProgress',
    'warning': 'warning',
    'error': 'error',
    'info': 'info',
    'unknown': 'unknown',
  };
  const normalizedStatus = status.toLowerCase().replace(/-/g, '_');
  const mappedKey = statusMap[normalizedStatus] || statusMap[normalizedStatus.replace(/_/g, '')] || 'unknown';
  return STATUS_ICONS[mappedKey] || STATUS_ICONS.unknown;
}

export function getActionIcon(action: string): LucideIcon {
  return ACTION_ICONS[action] || Plus;
}

export function getHierarchyIcon(level: string): LucideIcon {
  return HIERARCHY_ICONS[level] || Layers;
}

export function getHierarchyColor(level: string): string {
  return HIERARCHY_COLORS[level] || HIERARCHY_COLORS.scheme;
}
