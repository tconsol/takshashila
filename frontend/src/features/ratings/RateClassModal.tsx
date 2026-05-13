import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { TutorRatingStars } from './TutorRatingStars';
import { useSubmitRating } from './use-ratings';
import { getApiErrorMessage } from '../../utils/error';

interface Props {
  classPublicId: string;
  tutorName?: string;
  onClose: () => void;
  onDone?: () => void;
}

export function RateClassModal({ classPublicId, tutorName, onClose, onDone }: Props) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync: submit, isPending } = useSubmitRating();

  async function handleSubmit() {
    if (score === 0) { setError('Please select a star rating'); return; }
    try {
      await submit({ classPublicId, score, comment: comment.trim() || undefined });
      onDone?.();
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Rate ${tutorName ? `${tutorName}'s` : 'your'} class`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Skip</Button>
          <Button onClick={handleSubmit} disabled={isPending || score === 0}>
            {isPending ? 'Submitting…' : 'Submit Rating'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <TutorRatingStars rating={score} size="lg" interactive onChange={setScore} />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 h-5">
            {score > 0 ? labels[score] : 'Tap to rate'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Comment <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Share your experience with this class…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
          />
          <p className="text-right text-xs text-gray-400 mt-1">{comment.length}/500</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
