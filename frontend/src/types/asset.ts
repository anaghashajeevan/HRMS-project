// ==============================================================================
// ASSET MANAGEMENT TYPES
// ==============================================================================

export type AssetStatus = 'AVAILABLE' | 'ALLOCATED' | 'MAINTENANCE' | 'DISPOSED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type AllocationStatus = 'ALLOCATED' | 'RETURNED' | 'DAMAGED' | 'LOST';

export interface AssetCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  is_active: boolean;
  asset_count: number;
  allocated_count: number;
  available_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssetCurrentAssignee {
  id: string;
  employee_id: string;
  full_name: string;
  allocated_date: string;
  allocation_id: string;
}

export interface AssetListItem {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  category_name: string;
  category_icon: string;
  brand?: string;
  model_number?: string;
  serial_number: string;
  purchase_date?: string;
  status: AssetStatus;
  status_display: string;
  condition: AssetCondition;
  current_assignee: AssetCurrentAssignee | null;
}

export interface AssetCurrentAllocation {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  employee_email: string;
  allocated_date: string;
  expected_return_date?: string;
  duration_days: number;
  handover_notes?: string;
  allocated_by_name: string;
}

export interface AssetDetail {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  category_detail: AssetCategory;
  brand?: string;
  model_number?: string;
  serial_number: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  invoice_number?: string;
  warranty_expiry?: string;
  is_warranty_valid: boolean;
  status: AssetStatus;
  status_display: string;
  condition: AssetCondition;
  condition_display: string;
  condition_notes?: string;
  image?: string;
  image_url?: string;
  current_allocation: AssetCurrentAllocation | null;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetAllocation {
  id: string;
  asset: string;
  asset_detail: AssetListItem;
  employee: string;
  employee_detail: {
    id: string;
    employee_id: string;
    full_name: string;
    official_email: string;
    department_name?: string;
    position_title?: string;
  };
  allocated_date: string;
  expected_return_date?: string;
  returned_date?: string;
  status: AllocationStatus;
  status_display: string;
  duration_days: number;
  handover_notes?: string;
  return_notes?: string;
  recovery_cost: number;
  allocated_by?: string;
  allocated_by_name?: string;
  returned_to?: string;
  returned_to_name?: string;
  created_at: string;
}

export interface AllocateAssetPayload {
  asset_id: string;
  employee_id: string;
  allocated_date?: string;
  expected_return_date?: string;
  handover_notes?: string;
}

export interface ReturnAssetPayload {
  returned_date?: string;
  status: 'RETURNED' | 'DAMAGED' | 'LOST';
  return_notes?: string;
  recovery_cost?: number;
}

export interface AssetStats {
  summary: {
    total: number;
    allocated: number;
    available: number;
    maintenance: number;
    disposed: number;
    utilization_rate: number;
  };
  financial: {
    total_asset_value: number;
    allocated_asset_value: number;
    warranty_expiring_soon: number;
  };
  by_category: Array<{
    id: string;
    name: string;
    icon: string;
    total: number;
    allocated: number;
    available: number;
  }>;
  recent_activity: Array<{
    id: string;
    asset_tag: string;
    asset_name: string;
    employee_name: string;
    employee_code: string;
    status: AllocationStatus;
    allocated_date: string;
    returned_date?: string;
  }>;
}

export interface PaginatedAssets {
  count: number;
  next: string | null;
  previous: string | null;
  results: AssetListItem[];
}