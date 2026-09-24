// frontend/src/hooks/use-courses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesService } from '../services/courses.service';
import type { CreateCourseDto } from '../services/courses.service';
import { useToast } from '../components/ui/Toast';

export const courseKeys = {
  all: ['courses'] as const,
  catalog: (params?: Record<string, string>) => [...courseKeys.all, 'catalog', params] as const,
  admin: (params?: Record<string, string>) => [...courseKeys.all, 'admin', params] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
};

/** No `grade` = the "All grades" view of the district. */
export function useCourseCatalog(params: { districtId?: string; grade?: string; subject?: string }) {
  return useQuery({
    queryKey: courseKeys.catalog({ districtId: params.districtId ?? '', grade: params.grade ?? 'all', subject: params.subject ?? '' }),
    queryFn: () => coursesService.listCatalog(params),
    enabled: !!params.districtId,
  });
}

export function useAdminCourses(params?: Record<string, string>) {
  return useQuery({
    queryKey: courseKeys.admin(params),
    queryFn: () => coursesService.listForAdmin(params ?? {}),
  });
}

export function useCourse(coursePublicId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.detail(coursePublicId ?? ''),
    queryFn: () => coursesService.getByPublicId(coursePublicId!),
    enabled: !!coursePublicId,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (dto: CreateCourseDto) => coursesService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course created');
    },
    onError: (err: Error) => toast.error('Could not create course', err.message),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, dto }: { coursePublicId: string; dto: Partial<CreateCourseDto> }) =>
      coursesService.update(coursePublicId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course updated');
    },
    onError: (err: Error) => toast.error('Could not update course', err.message),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (coursePublicId: string) => coursesService.remove(coursePublicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success('Course deleted');
    },
    onError: (err: Error) => toast.error('Could not delete course', err.message),
  });
}

export function usePublishCourse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ coursePublicId, publish }: { coursePublicId: string; publish: boolean }) =>
      publish ? coursesService.publish(coursePublicId) : coursesService.unpublish(coursePublicId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      toast.success(vars.publish ? 'Course published' : 'Course unpublished');
    },
    onError: (err: Error) => toast.error('Could not update course', err.message),
  });
}
