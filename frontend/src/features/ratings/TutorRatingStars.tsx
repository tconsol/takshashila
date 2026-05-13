import { Star } from 'lucide-react';

interface Props {
  rating: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: false;
}

interface InteractiveProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive: true;
  onChange: (score: number) => void;
}

const sizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };

export function TutorRatingStars(props: Props | InteractiveProps) {
  const { rating, count, size = 'md', interactive = false } = props;
  const onChange = interactive ? (props as InteractiveProps).onChange : undefined;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
        >
          <Star
            className={`${sizes[size]} transition-colors ${
              star <= Math.round(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
            }`}
          />
        </button>
      ))}
      {count !== undefined && (
        <span className="text-xs text-gray-500 ml-1">
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}
