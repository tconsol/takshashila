import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { parentService } from '../services/parent.service';

export const parentKeys = {
  profile: () => ['parent', 'profile'] as const,
  children: () => ['parent', 'children'] as const,
  childClasses: (id: string, p?: Record<string, string>) => ['parent', 'child', id, 'classes', p] as const,
  childAttendance: (id: string, p?: Record<string, string>) => ['parent', 'child', id, 'attendance', p] as const,
  childAssignments: (id: string) => ['parent', 'child', id, 'assignments'] as const,
  childWorksheets: (id: string, p?: Record<string, string>) => ['parent', 'child', id, 'worksheets', p] as const,
};

export function useParentProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: parentKeys.profile(),
    queryFn: parentService.getProfile,
    retry: false,
    enabled: isAuthenticated,
  });
}

export function useParentChildren() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: parentKeys.children(),
    queryFn: parentService.getChildren,
    enabled: isAuthenticated,
  });
}

export function useLinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentPublicId: string) => parentService.linkChild(studentPublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: parentKeys.children() });
      qc.invalidateQueries({ queryKey: parentKeys.profile() });
    },
  });
}

export function useUnlinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentPublicId: string) => parentService.unlinkChild(studentPublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: parentKeys.children() });
      qc.invalidateQueries({ queryKey: parentKeys.profile() });
    },
  });
}

export function useChildClasses(studentPublicId: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: parentKeys.childClasses(studentPublicId, params),
    queryFn: () => parentService.getChildClasses(studentPublicId, params),
    enabled: !!studentPublicId,
  });
}

export function useChildAttendance(studentPublicId: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: parentKeys.childAttendance(studentPublicId, params),
    queryFn: () => parentService.getChildAttendance(studentPublicId, params),
    enabled: !!studentPublicId,
  });
}

export function useChildAssignments(studentPublicId: string) {
  return useQuery({
    queryKey: parentKeys.childAssignments(studentPublicId),
    queryFn: () => parentService.getChildAssignments(studentPublicId),
    enabled: !!studentPublicId,
  });
}

export function useChildWorksheets(studentPublicId: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: parentKeys.childWorksheets(studentPublicId, params),
    queryFn: () => parentService.getChildWorksheets(studentPublicId, params),
    enabled: !!studentPublicId,
  });
}
