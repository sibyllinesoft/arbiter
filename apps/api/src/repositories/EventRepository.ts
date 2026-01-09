import { SQL, and, desc, eq, gt, gte, inArray, lte } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../db/client";
import { events, type EventRow, projects } from "../db/schema";
import { getCurrentTimestamp } from "../io/utils";
import type { Event, EventType } from "../util/types";
import { mapEventRow, toSqliteTimestamp } from "./helpers";

type TxRunner = <T>(fn: (tx: SpecWorkbenchDrizzle) => Promise<T>) => Promise<T>;

export class EventRepository {
  constructor(
    private readonly drizzle: SpecWorkbenchDrizzle,
    private readonly runTx: TxRunner,
  ) {}

  private async getEventByIdInternal(
    id: string,
    tx: SpecWorkbenchDrizzle = this.drizzle,
  ): Promise<Event | null> {
    const [row] = await tx.select().from(events).where(eq(events.id, id)).limit(1);
    return row ? mapEventRow(row as EventRow) : null;
  }

  async createEvent(
    id: string,
    projectId: string,
    eventType: EventType,
    data: Record<string, unknown>,
  ): Promise<Event> {
    return this.runTx(async (tx) => {
      const [inserted] = await tx
        .insert(events)
        .values({
          id,
          projectId,
          eventType,
          data: JSON.stringify(data),
        })
        .returning();

      if (!inserted) throw new Error("Failed to create event");

      const event = mapEventRow(inserted as EventRow);
      return this.finalizeEventCreation(projectId, event, tx);
    });
  }

  /** Activate an event by setting isActive=1 and clearing revertedAt */
  private async activateEvent(eventId: string, tx: SpecWorkbenchDrizzle): Promise<void> {
    await tx.update(events).set({ isActive: 1, revertedAt: null }).where(eq(events.id, eventId));
  }

  /** Update project head to point to the given event */
  private async setProjectHead(
    projectId: string,
    eventId: string,
    tx: SpecWorkbenchDrizzle,
  ): Promise<void> {
    await tx.update(projects).set({ eventHeadId: eventId }).where(eq(projects.id, projectId));
  }

  /** Determine if we should update the project head to the new event */
  private async shouldUpdateHead(
    headEventId: string | null,
    event: Event,
    tx: SpecWorkbenchDrizzle,
  ): Promise<boolean> {
    if (!headEventId || headEventId === event.id) return !headEventId;

    const orm = tx as any;
    const [headRow] = await orm
      .select({ createdAt: events.createdAt })
      .from(events)
      .where(eq(events.id, headEventId))
      .limit(1);

    return !headRow || event.created_at > headRow.createdAt;
  }

  private async finalizeEventCreation(
    projectId: string,
    event: Event,
    tx: SpecWorkbenchDrizzle,
  ): Promise<Event> {
    const orm = tx as any;
    const [projectRow] = await orm
      .select({ eventHeadId: projects.eventHeadId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!projectRow) throw new Error(`Project ${projectId} not found`);

    const headEventId = projectRow.eventHeadId ?? null;

    if (await this.shouldUpdateHead(headEventId, event, tx)) {
      await this.setProjectHead(projectId, event.id, tx);
    }
    await this.activateEvent(event.id, tx);

    const updated = await this.getEventByIdInternal(event.id, tx);
    if (!updated) throw new Error("Failed to fetch event after creation");
    return updated;
  }

  getEventById(eventId: string): Promise<Event | null> {
    return this.getEventByIdInternal(eventId);
  }

  async getEvents(
    projectId: string,
    limit = 100,
    since?: string,
    includeDangling = true,
  ): Promise<Event[]> {
    const conditions: SQL[] = [eq(events.projectId, projectId)];

    if (since) conditions.push(gte(events.createdAt, toSqliteTimestamp(since)));

    if (!includeDangling) {
      conditions.push(eq(events.isActive, 1));
    }

    let whereClause: SQL | undefined = conditions[0];
    for (let i = 1; i < conditions.length; i += 1) {
      whereClause = whereClause ? and(whereClause, conditions[i]) : conditions[i];
    }

    const orm = this.drizzle as any;
    let query = orm.select().from(events);
    if (whereClause) {
      query = query.where(whereClause);
    }

    const rows = (await query.orderBy(desc(events.createdAt)).limit(limit)) as EventRow[];
    return rows.map((row) => mapEventRow(row));
  }

  async listEvents(projectId: string, limit = 100): Promise<Event[]> {
    return this.getEvents(projectId, limit);
  }

  async listEventsByType(projectId: string, eventType: EventType): Promise<Event[]> {
    const orm = this.drizzle as any;
    const rows = (await orm
      .select()
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.eventType, eventType)))
      .orderBy(desc(events.createdAt))) as EventRow[];
    return rows.map((row) => mapEventRow(row));
  }

  async getProjectEventHead(projectId: string): Promise<Event | null> {
    const orm = this.drizzle as any;
    const [projectRow] = (await orm
      .select({ eventHeadId: projects.eventHeadId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)) as Array<{ eventHeadId: string | null }>;

    if (!projectRow) {
      throw new Error(`Project ${projectId} not found`);
    }

    const headEventId = projectRow.eventHeadId ?? null;

    if (!headEventId) {
      const [latestActive] = (await orm
        .select()
        .from(events)
        .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)))
        .orderBy(desc(events.createdAt))
        .limit(1)) as EventRow[];
      return latestActive ? mapEventRow(latestActive) : null;
    }

    return this.getEventById(headEventId);
  }

  /** Validate project exists */
  private async validateProjectExists(projectId: string, orm: any): Promise<void> {
    const [projectRow] = (await orm
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)) as Array<{ id: string }>;

    if (!projectRow) {
      throw new Error(`Project ${projectId} not found`);
    }
  }

  /** Resolve target head event and timestamp */
  private async resolveTargetHead(
    projectId: string,
    headEventId: string | null,
    orm: any,
  ): Promise<{ targetHeadId: string | null; headTimestamp: string | null }> {
    if (!headEventId) {
      return { targetHeadId: null, headTimestamp: null };
    }

    const [headRow] = (await orm
      .select({ id: events.id, createdAt: events.createdAt })
      .from(events)
      .where(and(eq(events.id, headEventId), eq(events.projectId, projectId)))
      .limit(1)) as Array<{ id: string; createdAt: string }>;

    if (!headRow) {
      throw new Error("Head event not found for project");
    }

    return { targetHeadId: headRow.id, headTimestamp: headRow.createdAt };
  }

  /** Find events to reactivate (before head) and deactivate (after head) */
  private async findEventsToToggle(
    projectId: string,
    headTimestamp: string,
    orm: any,
  ): Promise<{ reactivateIds: string[]; deactivateIds: string[] }> {
    const toReactivate = (await orm
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.projectId, projectId),
          lte(events.createdAt, headTimestamp),
          eq(events.isActive, 0),
        ),
      )) as Array<{ id: string }>;

    const toDeactivate = (await orm
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.projectId, projectId),
          gt(events.createdAt, headTimestamp),
          eq(events.isActive, 1),
        ),
      )) as Array<{ id: string }>;

    return {
      reactivateIds: toReactivate.map((row) => row.id),
      deactivateIds: toDeactivate.map((row) => row.id),
    };
  }

  /** Reactivate events before the head timestamp */
  private async reactivateEventsBeforeHead(
    projectId: string,
    headTimestamp: string,
    tx: SpecWorkbenchDrizzle,
  ): Promise<void> {
    await tx
      .update(events)
      .set({ isActive: 1, revertedAt: null })
      .where(
        and(
          eq(events.projectId, projectId),
          lte(events.createdAt, headTimestamp),
          eq(events.isActive, 0),
        ),
      );
  }

  /** Deactivate events after the head timestamp */
  private async deactivateEventsAfterHead(
    projectId: string,
    headTimestamp: string,
    tx: SpecWorkbenchDrizzle,
  ): Promise<void> {
    await tx
      .update(events)
      .set({ isActive: 0, revertedAt: getCurrentTimestamp() })
      .where(
        and(
          eq(events.projectId, projectId),
          gt(events.createdAt, headTimestamp),
          eq(events.isActive, 1),
        ),
      );
  }

  /** Deactivate all events when head is null */
  private async deactivateAllEvents(
    projectId: string,
    tx: SpecWorkbenchDrizzle,
    orm: any,
  ): Promise<string[]> {
    await tx
      .update(events)
      .set({ isActive: 0, revertedAt: getCurrentTimestamp() })
      .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)));

    const deactivated = (await orm
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)))) as Array<{
      id: string;
    }>;

    return deactivated.map((row) => row.id);
  }

  async setEventHead(
    projectId: string,
    headEventId: string | null,
  ): Promise<{
    head: Event | null;
    reactivatedEventIds: string[];
    deactivatedEventIds: string[];
  }> {
    return this.runTx(async (tx) => {
      const orm = tx as any;

      await this.validateProjectExists(projectId, orm);

      const { targetHeadId, headTimestamp } = await this.resolveTargetHead(
        projectId,
        headEventId,
        orm,
      );

      let reactivatedEventIds: string[] = [];
      let deactivatedEventIds: string[] = [];

      if (headTimestamp) {
        const toggleResult = await this.findEventsToToggle(projectId, headTimestamp, orm);
        reactivatedEventIds = toggleResult.reactivateIds;
        deactivatedEventIds = toggleResult.deactivateIds;

        if (reactivatedEventIds.length > 0) {
          await this.reactivateEventsBeforeHead(projectId, headTimestamp, tx);
        }

        if (deactivatedEventIds.length > 0) {
          await this.deactivateEventsAfterHead(projectId, headTimestamp, tx);
        }
      } else {
        deactivatedEventIds = await this.deactivateAllEvents(projectId, tx, orm);
      }

      await tx
        .update(projects)
        .set({ eventHeadId: targetHeadId })
        .where(eq(projects.id, projectId));

      const head = targetHeadId ? await this.getEventByIdInternal(targetHeadId, tx) : null;

      return { head, reactivatedEventIds, deactivatedEventIds };
    });
  }

  async reactivateEvents(projectId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;

    await this.drizzle
      .update(events)
      .set({ isActive: 1, revertedAt: null })
      .where(and(eq(events.projectId, projectId), inArray(events.id, eventIds)));
  }

  async revertEvents(projectId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;

    const timestamp = getCurrentTimestamp();
    await this.drizzle
      .update(events)
      .set({ isActive: 0, revertedAt: timestamp })
      .where(and(eq(events.projectId, projectId), inArray(events.id, eventIds)));
  }
}
