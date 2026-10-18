import { anonymousApi, api } from '../client';
import type { Guid } from '../dto/common';
import type {
  AssignPermissionsRequestDto, ChangePasswordRequest, CreateRoleRequestDto, LoginRequest, LoginResponseDto, MeDto, PermissionDto,
  PermissionModuleDto, RegisterRequest, RoleDto, SwitchBusinessRequest, UpdateRoleRequestDto, UpdateUserRequestDto, UserDto,
} from '../dto/identity';

export const authApi = {
  login: (body: LoginRequest) => anonymousApi.post<LoginResponseDto>('/auth/Login', body),
  switchBusiness: (body: SwitchBusinessRequest) => api.post<LoginResponseDto>('/auth/switch-business', body),
  logout: (refreshToken: string) => api.post<unknown>('/auth/logout', { refreshToken }),
  me: () => api.get<MeDto>('/auth/me'),
  changePassword: (body: ChangePasswordRequest) => api.post<unknown>('/auth/change-password', body),
};

export const usersApi = {
  list: () => api.get<UserDto[]>('/users'),
  get: (id: Guid) => api.get<UserDto>(`/users/${id}`),
  /** Creates a user in the current business. */
  create: (body: RegisterRequest) => api.post<UserDto>('/auth/Register', body),
  update: (id: Guid, body: UpdateUserRequestDto) => api.put<UserDto>(`/users/${id}`, body),
  assignRoles: (id: Guid, roleIds: Guid[]) => api.put<UserDto>(`/users/${id}/roles`, { roleIds }),
  activate: (id: Guid) => api.post<UserDto>(`/users/${id}/activate`),
  deactivate: (id: Guid) => api.post<UserDto>(`/users/${id}/deactivate`),
  lock: (id: Guid) => api.post<UserDto>(`/users/${id}/lock`),
  unlock: (id: Guid) => api.post<UserDto>(`/users/${id}/unlock`),
  resetPassword: (id: Guid, newPassword: string) => api.post<UserDto>(`/users/${id}/reset-password`, { newPassword }),
};

export const rolesApi = {
  list: () => api.get<RoleDto[]>('/roles'),
  get: (id: Guid) => api.get<RoleDto>(`/roles/${id}`),
  create: (body: CreateRoleRequestDto) => api.post<RoleDto>('/roles', body),
  update: (id: Guid, body: UpdateRoleRequestDto) => api.put<RoleDto>(`/roles/${id}`, body),
  activate: (id: Guid) => api.post<RoleDto>(`/roles/${id}/activate`),
  deactivate: (id: Guid) => api.post<RoleDto>(`/roles/${id}/deactivate`),
  /** Replaces the role's permission set. */
  assignPermissions: (id: Guid, body: AssignPermissionsRequestDto) => api.put<RoleDto>(`/roles/${id}/permissions`, body),
};

export const permissionsApi = {
  /** Business permissions only: platform permissions are left out. */
  list: () => api.get<PermissionDto[]>('/permissions'),
  modules: () => api.get<PermissionModuleDto[]>('/permissions/modules'),
};
