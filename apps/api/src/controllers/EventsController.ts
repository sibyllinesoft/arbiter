import type { EventService } from "../io/events";
import type { SpecWorkbenchDB } from "../util/db";

type Dependencies = Record<string, unknown>;

export class EventsController {
  private db: SpecWorkbenchDB;
  private events?: EventService;

  constructor(deps: Dependencies) {
    this.db = deps.db as SpecWorkbenchDB;
    this.events = deps.events as EventService | undefined;
  }

  async list(projectId: string, limit: number, since?: string, includeDangling = true) {
    const events = await this.db.getEvents(projectId, limit, since, includeDangling);
    const headEvent = await this.db.getProjectEventHead(projectId);
    const danglingEventIds = events.filter((event) => !event.is_active).map((event) => event.id);

    return {
      events,
      head_event: headEvent,
      head_event_id: headEvent?.id ?? null,
      dangling_event_ids: danglingEventIds,
    };
  }

  async setHead(projectId: string, headEventId: string | null) {
    const result = await this.db.setEventHead(projectId, headEventId ?? null);
    if (this.events?.broadcastToProject) {
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "event_head_updated",
        data: {
          head_event_id: result.head?.id ?? null,
          head_event: result.head,
          reactivated_event_ids: result.reactivatedEventIds,
          deactivated_event_ids: result.deactivatedEventIds,
        },
      });
    }
    return {
      head_event: result.head,
      head_event_id: result.head?.id ?? null,
      reactivated_event_ids: result.reactivatedEventIds,
      deactivated_event_ids: result.deactivatedEventIds,
    };
  }

  async revert(projectId: string, eventIds: string[]) {
    await this.db.revertEvents(projectId, eventIds);
    return {
      head_event: null,
      head_event_id: null,
      reverted_event_ids: eventIds,
    };
  }
}
