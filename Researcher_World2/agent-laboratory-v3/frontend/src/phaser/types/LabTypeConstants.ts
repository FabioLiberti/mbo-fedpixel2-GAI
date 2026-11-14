/**
 * Costanti per identificare i tipi di laboratorio
 * Queste costanti sono usate quando è necessario fare riferimento a un laboratorio specifico
 * senza dover usare l'oggetto LabType completo
 */
export const LAB_TYPES = {
    MERCATORUM: 'MERCATORUM',
    BLEKINGE: 'BLEKINGE',
    OPBG: 'OPBG'
  } as const;
  
  export type LabTypeId = typeof LAB_TYPES[keyof typeof LAB_TYPES];