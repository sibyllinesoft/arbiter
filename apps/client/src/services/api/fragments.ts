import type { CreateFragmentRequest, CreateFragmentResponse, Fragment } from "@/types/api";
import { ApiClient } from "./client";

export class FragmentService {
  constructor(private readonly client: ApiClient) {}

  async getFragments(projectId: string): Promise<Fragment[]> {
    return this.client.request<Fragment[]>(`/api/fragments?projectId=${projectId}`);
  }

  async getFragment(projectId: string, fragmentId: string): Promise<Fragment> {
    return this.client.request<Fragment>(`/api/fragments/${fragmentId}?projectId=${projectId}`);
  }

  async createFragment(
    projectId: string,
    request: CreateFragmentRequest,
  ): Promise<CreateFragmentResponse> {
    return this.client.request<CreateFragmentResponse>(`/api/fragments?projectId=${projectId}`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async updateFragment(projectId: string, fragmentId: string, content: string): Promise<Fragment> {
    return this.client.request<Fragment>(`/api/fragments/${fragmentId}?projectId=${projectId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async deleteFragment(projectId: string, fragmentId: string): Promise<void> {
    await this.client.request<void>(`/api/fragments/${fragmentId}?projectId=${projectId}`, {
      method: "DELETE",
    });
  }
}
