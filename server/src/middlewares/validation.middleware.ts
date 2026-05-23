import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/error';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
      return next(new ValidationError(fieldErrors));
    }

    req[target] = result.data;
    next();
  };
}
