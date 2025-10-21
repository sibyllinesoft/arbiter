/**
 * Default Webhook Handler
 * Notifies Arbiter users whenever a GitLab webhook is received.
 */

const DEFAULT_HANDLER_ID = "default-webhook-notifier";

async function defaultWebhookHandler(payload, context) {
  const { logger, provider, event, projectId } = context;
  const repository =
    payload?.parsed?.repository?.fullName || payload?.repository?.path_with_namespace || "unknown";

  const message = `Default webhook handler triggered for ${provider} ${event}`;
  logger.info(message, { projectId, repository });

  const actions = [`Displayed notification for ${provider} ${event}`];

  return {
    success: true,
    message,
    actions,
    data: {
      provider,
      event,
      repository,
    },
  };
}

module.exports = {
  handler: defaultWebhookHandler,
  config: {
    enabled: true,
    timeout: 5000,
    retries: 0,
  },
  metadata: {
    id: DEFAULT_HANDLER_ID,
    name: "Default Webhook Notifier",
    description: "Displays a project notification whenever any webhook event is received.",
    version: "1.0.0",
    supportedEvents: ["*", "default"],
    requiredPermissions: [],
  },
};
