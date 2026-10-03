// frontend/src/components/shared/StudentLocationModal.tsx
//
// A tutor or principal sets where one of their students goes to school (state and county). It decides
// which state curriculum and county programs the student sees.
import { useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StateCountyFields, type StateCounty } from './StateCountyFields';
import { useSetStudentLocation } from '../../hooks/use-students';

export function StudentLocationModal({ student, onClose }: {
  student: { publicId: string; name: string; state?: string; countyFips?: string };
  onClose: () => void;
}) {
  const { mutate: save, isPending } = useSetStudentLocation();
  const [place, setPlace] = useState<StateCounty>({ state: student.state ?? '', countyFips: student.countyFips ?? '' });

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Where does ${student.name} go to school?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="gradient"
            loading={isPending}
            disabled={!place.state}
            onClick={() => save({ studentPublicId: student.publicId, state: place.state, countyFips: place.countyFips || undefined }, { onSuccess: onClose })}
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <StateCountyFields value={place} onChange={setPlace} />
        <p className="text-xs text-gray-500">
          This decides which state curriculum and county programs the student sees. The student or a parent can change it later in their profile.
        </p>
      </div>
    </Modal>
  );
}
