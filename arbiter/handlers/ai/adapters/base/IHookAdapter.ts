import type { WebhookEvent } from '../../../shared/utils.js';
import type { WebhookEventData } from '../../base/types.js';

/**
 * Interface for webhook adapters that extract structured data from provider-specific payloads
 */
export interface IHookAdapter {
  /**
   * The provider this adapter supports (github, gitlab, etc.)
   */
  readonly provider: string;

  /**
   * The event type this adapter handles (push, pull_request, etc.)
   */
  readonly eventType: string;

  /**
   * Extract structured event data from the webhook payload
   */
  extractEventData(event: WebhookEvent): Promise<WebhookEventData>;

  /**
   * Validate that this adapter can handle the given event
   */
  canHandle(event: WebhookEvent): boolean;

  /**
   * Get the adapter's configuration and metadata
   */
  getMetadata(): {
    name: string;
    version: string;
    description: string;
    supportedEvents: string[];
  };
}

/**
 * Base class for webhook adapters with common functionality
 */
export abstract class BaseHookAdapter implements IHookAdapter {
  abstract readonly provider: string;
  abstract readonly eventType: string;

  /**
   * Default implementation that checks provider and event type
   */
  canHandle(event: WebhookEvent): boolean {
    return event.provider === this.provider && event.eventType === this.eventType;
  }

  /**
   * Extract common repository information across providers
   */
  protected extractRepositoryInfo(payload: any): {
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
  } | null {
    try {
      switch (this.provider) {
        case 'github':
          if (payload.repository) {
            return {
              name: payload.repository.name,
              fullName: payload.repository.full_name,
              url: payload.repository.html_url,
              defaultBranch: payload.repository.default_branch || 'main',
            };
          }
          break;

        case 'gitlab':
          if (payload.project) {
            return {
              name: payload.project.name,
              fullName: payload.project.path_with_namespace,
              url: payload.project.web_url,
              defaultBranch: payload.project.default_branch || 'main',
            };
          }
          break;

        default:
          return null;
      }
    } catch (error) {
      console.error(`Error extracting repository info for ${this.provider}:`, error);
      return null;
    }

    return null;
  }

  /**
   * Extract common user information across providers
   */
  protected extractUserInfo(
    payload: any,
    context: 'author' | 'pusher' | 'sender' = 'sender'
  ): {
    login: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | null {
    try {
      let userObj;

      switch (this.provider) {
        case 'github':
          switch (context) {
            case 'author':
              userObj =
                payload.pull_request?.user || payload.issue?.user || payload.head_commit?.author;
              break;
            case 'pusher':
              userObj = payload.pusher || payload.sender;
              break;
            default:
              userObj = payload.sender;
              break;
          }

          if (userObj) {
            return {
              login: userObj.login || userObj.username,
              name: userObj.name,
              email: userObj.email,
              avatarUrl: userObj.avatar_url,
            };
          }
          break;

        case 'gitlab':
          switch (context) {
            case 'author':
              userObj = payload.object_attributes?.author || payload.user;
              break;
            default:
              userObj = payload.user;
              break;
          }

          if (userObj) {
            return {
              login: userObj.username,
              name: userObj.name,
              email: userObj.email,
              avatarUrl: userObj.avatar_url,
            };
          }
          break;
      }
    } catch (error) {
      console.error(`Error extracting user info for ${this.provider}:`, error);
      return null;
    }

    return null;
  }

  /**
   * Create a successful response with extracted data
   */
  protected createSuccessResponse(data: any): WebhookEventData {
    return {
      success: true,
      data,
    };
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(error: string): WebhookEventData {
    return {
      success: false,
      error,
      data: {} as any,
    };
  }

  /**
   * Validate required fields in payload
   */
  protected validatePayload(payload: any, requiredFields: string[]): string[] {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (this.getNestedValue(payload, field) === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return errors;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Default metadata implementation
   */
  getMetadata(): {
    name: string;
    version: string;
    description: string;
    supportedEvents: string[];
  } {
    return {
      name: `${this.provider}-${this.eventType}-adapter`,
      version: '1.0.0',
      description: `Adapter for ${this.provider} ${this.eventType} events`,
      supportedEvents: [this.eventType],
    };
  }

  /**
   * Abstract method to be implemented by concrete adapters
   */
  abstract extractEventData(event: WebhookEvent): Promise<WebhookEventData>;
}
