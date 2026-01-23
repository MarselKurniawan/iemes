// Shared label maps for report exports + tables

export type AssetCategory =
  | 'peralatan_kamar'
  | 'peralatan_dapur'
  | 'mesin_laundry_housekeeping'
  | 'kendaraan_operasional'
  | 'peralatan_kantor_it'
  | 'peralatan_rekreasi_leisure'
  | 'infrastruktur';

export type AssetCondition = 'baik' | 'cukup' | 'perlu_perbaikan' | 'rusak';
export type AssetStatus = 'aktif' | 'dalam_perbaikan' | 'tidak_aktif' | 'dihapuskan';

export type MaintenanceType = 'renovasi_lokasi' | 'perbaikan_aset';
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export const categoryLabels: Record<AssetCategory, string> = {
  peralatan_kamar: 'Peralatan Kamar',
  peralatan_dapur: 'Peralatan Dapur',
  mesin_laundry_housekeeping: 'Mesin Laundry & Housekeeping',
  kendaraan_operasional: 'Kendaraan Operasional',
  peralatan_kantor_it: 'Peralatan Kantor & IT',
  peralatan_rekreasi_leisure: 'Peralatan Rekreasi & Leisure',
  infrastruktur: 'Infrastruktur',
};

export const conditionLabels: Record<AssetCondition, string> = {
  baik: 'Baik',
  cukup: 'Cukup',
  perlu_perbaikan: 'Perlu Perbaikan',
  rusak: 'Rusak',
};

export const statusLabels: Record<AssetStatus, string> = {
  aktif: 'Aktif',
  dalam_perbaikan: 'Dalam Perbaikan',
  tidak_aktif: 'Tidak Aktif',
  dihapuskan: 'Dihapuskan',
};

export const typeLabels: Record<MaintenanceType, string> = {
  renovasi_lokasi: 'Renovasi Lokasi',
  perbaikan_aset: 'Perbaikan Aset',
};

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  pending_approval: 'Menunggu Approval',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};
