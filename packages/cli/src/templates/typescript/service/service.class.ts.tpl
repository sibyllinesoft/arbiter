/**
 * {{serviceName}} Service
 * Business logic for {{serviceName}} operations
 */

export class {{serviceName}}Service {
  async findAll(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async findById(id: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async create(data: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async update(id: string, data: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}

export const {{serviceInstanceName}} = new {{serviceName}}Service();
