// This application doesn't require persistent storage
// All operations are stateless request/response cycles
export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
