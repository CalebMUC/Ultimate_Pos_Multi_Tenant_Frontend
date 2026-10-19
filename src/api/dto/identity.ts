// Application/Identity/Dtos/AuthDtos.cs
import type { BusinessKind, BusinessType } from '../enums';
import type { DateTimeString, Guid } from './common';
import type { AccessStatus, BusinessAccessDto } from './platform';
import type { BranchMembershipDto } from './branches';

/** branchId: the branch to work at; left out, the user's default. */
export interface LoginRequest { email: string; password: string; businessId?: Guid | null; branchId?: Guid | null }
/** branchIds left out: the creator's current branch. defaultBranchId must be one of them. */
export interface RegisterRequest {
  email: string; password: string; fullName: string; phoneNumber: string; roleName: string;
  branchIds?: Guid[] | null; defaultBranchId?: Guid | null;
}

export interface UserDto {
  id: Guid;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  isActive: boolean;
  isLocked: boolean;
  roles: string[];
  permissions: string[];
}

export interface BusinessMembershipDto {
  businessId: Guid;
  businessName: string;
  tradingName: string | null;
  kind: BusinessKind;
  businessType: BusinessType;
  isDefault: boolean;
  /** Active, ExpiringSoon, GracePeriod, Expired, Unlicensed, Suspended or Closed: for the business picker. */
  accessStatus?: AccessStatus | null;
}

export interface LoginResponseDto {
  token: string;
  expiresAt: DateTimeString;
  user: UserDto;
  refreshToken: string;
  refreshTokenExpiresAt: DateTimeString;
  /** Null when the user has platform access only. */
  activeBusinessId: Guid | null;
  businesses: BusinessMembershipDto[];
  /** Someone else set the password: the user must change it before anything else. */
  mustChangePassword?: boolean;
  /** Banner text: the licence ends soon, or has ended and is in its grace period. */
  licenseWarning?: string | null;
  /** The branch the token is for. Null only for super users (no business). */
  activeBranchId?: Guid | null;
  /** Where the user may work in this business, default first. */
  branches?: BranchMembershipDto[];
}

export interface MeDto {
  user: UserDto;
  activeBusinessId: Guid | null;
  businesses: BusinessMembershipDto[];
  mustChangePassword?: boolean;
  businessAccess?: BusinessAccessDto | null;
  activeBranchId?: Guid | null;
  branches?: BranchMembershipDto[];
}
/** branchId left out: the user's default branch in that business. */
export interface SwitchBusinessRequest { businessId: Guid; refreshToken: string | null; branchId?: Guid | null }
export interface SwitchBranchRequest { branchId: Guid; refreshToken: string | null }
export interface ChangePasswordRequest { currentPassword: string; newPassword: string }
export interface ResetPasswordRequest { newPassword: string }
export interface UpdateUserRequestDto { fullName: string; email: string; phoneNumber: string | null }

export interface RoleDto { roleId: Guid; roleName: string; description: string | null; isActive: boolean; permissions: string[] }
export interface CreateRoleRequestDto { roleName: string; description: string | null }
export type UpdateRoleRequestDto = CreateRoleRequestDto;
export interface AssignRolesRequestDto { roleIds: Guid[] }
export interface AssignPermissionsRequestDto { permissionIds: Guid[] }
export interface PermissionDto { permissionId: Guid; name: string; module: string; isActive: boolean }
export interface PermissionModuleDto { module: string; permissions: string[] }
