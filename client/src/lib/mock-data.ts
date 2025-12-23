
export interface Property {
  id: string;
  uprn: string;
  address: string;
  type: "House" | "Flat" | "Block" | "Bungalow";
  status: "Compliant" | "Non-Compliant" | "Attention" | "Investigation";
  compliance: {
    gas: "Pass" | "Fail" | "Due Soon" | "N/A";
    elec: "Pass" | "Fail" | "Due Soon" | "N/A";
    fire: "Pass" | "Fail" | "Due Soon" | "N/A";
    asbestos: "Pass" | "Fail" | "Due Soon" | "N/A";
    water: "Pass" | "Fail" | "Due Soon" | "N/A";
    lift: "Pass" | "Fail" | "Due Soon" | "N/A";
  };
  image?: string;
  tenant?: string;
}

export const properties: Property[] = [
  { 
    id: "PROP-001", 
    uprn: "100023456789", 
    address: "124 High Street, London, SW1 4AX", 
    type: "House", 
    status: "Compliant", 
    compliance: { gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    tenant: "Sarah Jenkins"
  },
  { 
    id: "PROP-002", 
    uprn: "100023456790", 
    address: "Flat 4, Oak House, Green Lane, E17", 
    type: "Flat", 
    status: "Non-Compliant", 
    compliance: { gas: "Pass", elec: "Fail", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "Pass" },
    tenant: "Mike Ross"
  },
  { 
    id: "PROP-003", 
    uprn: "100023456791", 
    address: "12 Green Lane, Manchester, M1 2AB", 
    type: "House", 
    status: "Attention", 
    compliance: { gas: "Due Soon", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    tenant: "Vacant"
  },
  { 
    id: "PROP-004", 
    uprn: "100023456792", 
    address: "The Towers (Block A), Leeds, LS1", 
    type: "Block", 
    status: "Compliant", 
    compliance: { gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "Pass" },
  },
  { 
    id: "PROP-005", 
    uprn: "100023456793", 
    address: "56 Maple Drive, Birmingham, B2", 
    type: "Bungalow", 
    status: "Compliant", 
    compliance: { gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    tenant: "Elderly Care"
  },
  { 
    id: "PROP-006", 
    uprn: "100023456794", 
    address: "Flat 2b, The Towers, Leeds, LS1", 
    type: "Flat", 
    status: "Investigation", 
    compliance: { gas: "Pass", elec: "Pass", fire: "Fail", asbestos: "Pass", water: "Pass", lift: "Pass" },
    tenant: "John Doe"
  },
];

export interface Contractor {
  id: string;
  name: string;
  type: string;
  status: "Approved" | "Pending" | "Suspended";
  staff: number;
  jobs: number;
  rating: number | string;
  email: string;
  phone: string;
  address: string;
  accreditations: string[];
}

export const contractors: Contractor[] = [
  { id: "CONT-001", name: "Gas Safe Pros Ltd", type: "Gas & Heating", status: "Approved", staff: 12, jobs: 45, rating: 4.8, email: "info@gassafepros.co.uk", phone: "020 7123 4567", address: "12 Industrial Est, London", accreditations: ["Gas Safe", "Chas"] },
  { id: "CONT-002", name: "Sparky's Electric", type: "Electrical", status: "Approved", staff: 8, jobs: 22, rating: 4.5, email: "jobs@sparkys.co.uk", phone: "0161 987 6543", address: "44 Voltage Way, Manchester", accreditations: ["NICEIC", "SafeContractor"] },
  { id: "CONT-003", name: "CleanTeam Services", type: "Cleaning & Hygiene", status: "Pending", staff: 24, jobs: 0, rating: "-", email: "admin@cleanteam.com", phone: "0800 111 2222", address: "88 Hygiene Hub, Birmingham", accreditations: ["BICS"] },
  { id: "CONT-004", name: "Secure Fire Safety", type: "Fire Protection", status: "Approved", staff: 5, jobs: 18, rating: 4.9, email: "contact@securefire.co.uk", phone: "0113 444 5555", address: "Fire Station Rd, Leeds", accreditations: ["BAFE", "FIA"] },
  { id: "CONT-005", name: "BuildRight Construction", type: "General Building", status: "Suspended", staff: 15, jobs: 2, rating: 3.2, email: "info@buildright.co.uk", phone: "020 8888 9999", address: "Builder's Yard, London", accreditations: ["Constructionline"] },
];

export interface RemedialAction {
  id: string;
  propId: string;
  property: string;
  issue: string;
  description: string;
  source: "EICR" | "FRA" | "Gas Safety" | "Tenant Report" | "Damp Survey";
  severity: "IMMEDIATE" | "URGENT" | "PRIORITY" | "ROUTINE";
  status: "Open" | "In Progress" | "Scheduled" | "Completed";
  assignedTo: string;
  dueDate: string;
  raisedDate: string;
  costEstimate?: string;
}

export const remedialActions: RemedialAction[] = [
  { id: "ACT-1024", propId: "PROP-003", property: "12 Green Lane", issue: "C1 Danger Present", description: "Exposed live conductors in kitchen socket.", source: "EICR", severity: "IMMEDIATE", status: "Open", assignedTo: "Sparky's Electric", dueDate: "Today", raisedDate: "2025-12-23", costEstimate: "£150" },
  { id: "ACT-1025", propId: "PROP-002", property: "Flat 4, Oak House", issue: "Boiler Pressure Loss", description: "Tenant reports boiler losing pressure daily. Leak suspect.", source: "Tenant Report", severity: "URGENT", status: "In Progress", assignedTo: "Gas Safe Pros Ltd", dueDate: "Tomorrow", raisedDate: "2025-12-22", costEstimate: "£250" },
  { id: "ACT-1022", propId: "PROP-004", property: "The Towers (Block A)", issue: "Fire Door Gap > 3mm", description: "Communal fire door on 3rd floor has excessive gap at base.", source: "FRA", severity: "PRIORITY", status: "Open", assignedTo: "Unassigned", dueDate: "7 Days", raisedDate: "2025-12-20", costEstimate: "£450" },
  { id: "ACT-1020", propId: "PROP-005", property: "56 Maple Drive", issue: "Mould Wash Required", description: "Black mould in bathroom ceiling. Needs fungicidal wash and painting.", source: "Damp Survey", severity: "ROUTINE", status: "Scheduled", assignedTo: "CleanTeam Services", dueDate: "14 Days", raisedDate: "2025-12-15", costEstimate: "£180" },
  { id: "ACT-1018", propId: "PROP-001", property: "124 High Street", issue: "Loose Roof Tile", description: "Single tile slipped on main roof slope.", source: "Tenant Report", severity: "ROUTINE", status: "Completed", assignedTo: "BuildRight Construction", dueDate: "Yesterday", raisedDate: "2025-12-10", costEstimate: "£120" },
];

export interface Certificate {
  id: string;
  type: string;
  property: string;
  propId: string;
  status: "Valid" | "Expiring Soon" | "Overdue" | "Missing";
  expiry: string;
  outcome: "PASS" | "FAIL" | "SATISFACTORY" | "ACTION REQUIRED";
  date: string;
  engineer?: string;
}

export const certificates: Certificate[] = [
  { id: "CERT-001", type: "Gas Safety (CP12)", property: "124 High Street", propId: "PROP-001", status: "Valid", expiry: "2026-12-14", outcome: "PASS", date: "2025-12-14", engineer: "John Smith (Gas Safe Pros)" },
  { id: "CERT-002", type: "EICR", property: "Flat 4, Oak House", propId: "PROP-002", status: "Valid", expiry: "2028-05-20", outcome: "SATISFACTORY", date: "2023-05-20", engineer: "Dave Wilson (Sparky's)" },
  { id: "CERT-003", type: "Fire Risk Assessment", property: "The Towers (Block A)", propId: "PROP-004", status: "Expiring Soon", expiry: "2025-01-15", outcome: "ACTION REQUIRED", date: "2024-01-15", engineer: "Secure Fire Safety" },
  { id: "CERT-004", type: "Legionella RA", property: "The Towers (Block A)", propId: "PROP-004", status: "Overdue", expiry: "2024-11-01", outcome: "FAIL", date: "2022-11-01", engineer: "AquaSafe Ltd" },
  { id: "CERT-005", type: "Gas Safety (CP12)", property: "56 Maple Drive", propId: "PROP-005", status: "Valid", expiry: "2026-02-10", outcome: "PASS", date: "2025-02-10", engineer: "Sarah Jones (Gas Safe Pros)" },
  { id: "CERT-006", type: "EICR", property: "12 Green Lane", propId: "PROP-003", status: "Valid", expiry: "2027-08-15", outcome: "SATISFACTORY", date: "2022-08-15", engineer: "Dave Wilson (Sparky's)" },
];
