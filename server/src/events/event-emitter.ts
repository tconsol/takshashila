import { EventEmitter } from 'events';
import { logger } from '../lib/logger';
import { DomainEvent } from '../constants/events';

class DomainEventEmitter extends EventEmitter {
  emit(event: DomainEvent | string, ...args: unknown[]): boolean {
    logger.debug(`Domain event emitted: ${event}`);
    return super.emit(event, ...args);
  }
}

export const domainEvents = new DomainEventEmitter();
domainEvents.setMaxListeners(50);
