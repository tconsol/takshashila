// frontend/src/hooks/use-county-additions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { countyAdditionsService } from '../services/county-additions.service';
import type { CountyAdditionInput } from '../services/county-additions.service';
import { useToast } from '../components/ui/Toast';

const keys = { all: ['county-additions'] as const };

/** Published add-ons for a county; nothing is fetched until both state and county are known. */
export function useCountyAdditions(stateCode: string | undefined, countyFips: string | undefined, grade?: string) {
  return useQuery({
    queryKey: [...keys.all, 'county', stateCode ?? '', countyFips ?? '', grade ?? 'all'] as const,
    queryFn: () => countyAdditionsService.forCounty({ stateCode: stateCode!, countyFips: countyFips!, grade }),
    enabled: !!stateCode && !!countyFips,
  });
}

export function useAdminCountyAdditions(stateCode: string | undefined) {
  return useQuery({
    queryKey: [...keys.all, 'admin', stateCode ?? ''] as const,
    queryFn: () => countyAdditionsService.listForAdmin(stateCode!),
    enabled: !!stateCode,
  });
}

function useMutate<V, R>(fn: (v: V) => Promise<R>, ok: string, fail: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.all }); toast.success(ok); },
    onError: (err: Error) => toast.error(fail, err.message),
  });
}

export const useCreateCountyAddition = () =>
  useMutate((dto: CountyAdditionInput & { stateCode: string }) => countyAdditionsService.create(dto), 'County add-on created', 'Could not create add-on');

export const useUpdateCountyAddition = () =>
  useMutate(({ publicId, dto }: { publicId: string; dto: Partial<CountyAdditionInput> }) => countyAdditionsService.update(publicId, dto), 'County add-on updated', 'Could not update add-on');

export const usePublishCountyAddition = () =>
  useMutate(({ publicId, publish }: { publicId: string; publish: boolean }) => (publish ? countyAdditionsService.publish(publicId) : countyAdditionsService.unpublish(publicId)),
    'County add-on updated', 'Could not update add-on');

export const usePublishAllCountyAdditions = () =>
  useMutate((params: { stateCode: string; countyFips?: string }) => countyAdditionsService.publishAll(params), 'County programs published', 'Could not publish programs');

export const useDeleteCountyAddition = () =>
  useMutate((publicId: string) => countyAdditionsService.remove(publicId), 'County add-on deleted', 'Could not delete add-on');
