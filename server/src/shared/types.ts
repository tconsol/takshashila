import type { Request } from 'express';
import type { Role } from '../constants/roles';
import type { Permission } from '../constants/permissions';

export interface AuthPayload {
  userId: string;
  publicId: string;
  role: Role;
  sessionId: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]> | string[];
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  device?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type SortOrder = 'asc' | 'desc';

export interface BaseDocument {
  _id: string;
  publicId: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface AuditMeta {
  actorId: string;
  actorRole: Role;
  ip?: string;
  userAgent?: string;
  resourceType: string;
  resourceId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export type CapabilityMap = Map<Permission, boolean>;
