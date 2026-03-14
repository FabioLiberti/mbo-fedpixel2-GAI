/**
 * Enumeration degli stati possibili del processo Federated Learning
 */
export enum FLState {
    IDLE = 'idle',
    TRAINING = 'training', 
    SENDING = 'sending',
    AGGREGATING = 'aggregating',
    RECEIVING = 'receiving'
  }