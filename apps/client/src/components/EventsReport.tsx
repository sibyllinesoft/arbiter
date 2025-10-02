import { useProjectEvents } from '@/hooks/api-hooks';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiService } from '@/services/api';
import type { Event } from '@/types/api';
import {
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  PlusCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface EventsReportProps {
  projectId: string;
}

const sortEventsDesc = (entries: Event[]): Event[] =>
  [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

const toShortId = (value: unknown, length = 8): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}…`;
};

const humanizeKey = (key: string) =>
  key
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed || 'n/a';
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return Number(value).toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    const formatted = value.map(item => formatValue(item));
    const preview = formatted.slice(0, 3).join(', ');
    return formatted.length > 3 ? `${preview} +${formatted.length - 3} more` : preview;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null
    );
    if (entries.length === 0) return '—';
    const preview = entries
      .slice(0, 3)
      .map(([entryKey, val]) => `${humanizeKey(entryKey)}=${formatValue(val)}`)
      .join(', ');
    return entries.length > 3 ? `${preview} +${entries.length - 3} more` : preview;
  }
  return String(value);
};

const formatDuration = (ms?: number): string | undefined => {
  if (ms === undefined || Number.isNaN(ms)) return undefined;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m${remaining ? ` ${remaining}s` : ''}`;
};

const emphasizeLabel = (value: string): string => humanizeKey(value);

type DetailRow = { label: string; value: string };

const summarizeGeneric = (data: Record<string, unknown>): string => {
  const entries = Object.entries(data ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (entries.length === 0) {
    return 'No additional details provided.';
  }
  const preview = entries
    .slice(0, 3)
    .map(([key, value]) => `${humanizeKey(key)}: ${formatValue(value)}`)
    .join(' · ');
  const remaining = entries.length - 3;
  return remaining > 0 ? `${preview} · +${remaining} more` : preview;
};

const formatEventSummary = (
  event: Event,
  lookupEvent?: (eventId: string) => Event | undefined,
  seen: Set<string> = new Set()
): string => {
  if (seen.has(event.id)) {
    return event.event_type;
  }
  seen.add(event.id);

  const data = (event.data ?? {}) as Record<string, unknown>;

  const getString = (key: string): string | undefined => {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return undefined;
  };
  const getNumber = (key: string): number | undefined => {
    const value = data[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };
  const getArray = (key: string): unknown[] =>
    Array.isArray(data[key]) ? (data[key] as unknown[]) : [];
  const join = (...parts: (string | undefined)[]) => {
    const filtered = parts.filter(Boolean) as string[];
    return filtered.length > 0 ? filtered.join(' · ') : '';
  };

  const describeById = (id?: string): string | undefined => {
    if (!id || !lookupEvent) return undefined;
    const referenced = lookupEvent(id);
    if (!referenced) return undefined;
    return formatEventSummary(referenced, lookupEvent, new Set(seen));
  };

  const describeEventLike = (value: unknown, fallbackId?: string): string | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const raw = value as Partial<Event> & Record<string, unknown>;
    const type = raw.event_type;
    if (!type || typeof type !== 'string') return undefined;
    const normalized: Event = {
      id: String(raw.id ?? fallbackId ?? `${event.id}-ref`),
      project_id: String(raw.project_id ?? event.project_id),
      event_type: type as Event['event_type'],
      data: raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {},
      is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
      reverted_at: raw.reverted_at ?? null,
      created_at: typeof raw.created_at === 'string' ? raw.created_at : event.created_at,
    };
    return formatEventSummary(normalized, lookupEvent, new Set(seen));
  };

  const fragmentPath = getString('fragment_path') ?? getString('path');
  const fragmentId = getString('fragment_id');
  const fragmentLabel = fragmentPath ?? toShortId(fragmentId) ?? 'fragment';
  const user = getString('user_id') ?? getString('author') ?? getString('user');

  switch (event.event_type) {
    case 'fragment_created': {
      const contentLength = getNumber('content_length');
      const createdLabel =
        fragmentLabel === 'fragment' ? 'Added fragment' : `Added fragment ${fragmentLabel}`;
      return (
        join(
          createdLabel,
          user ? `by ${user}` : undefined,
          contentLength ? `${contentLength.toLocaleString()} chars` : undefined
        ) || 'Added fragment'
      );
    }
    case 'fragment_updated': {
      const revisionIdValue = getString('revision_id');
      const revisionNumberValue = getNumber('revision_number');
      const revision = revisionIdValue
        ? toShortId(revisionIdValue)
        : revisionNumberValue !== undefined
          ? revisionNumberValue.toString()
          : undefined;
      const length = getNumber('content_length');
      const changes =
        data.changes && typeof data.changes === 'object' ? formatValue(data.changes) : undefined;
      const updatedLabel =
        fragmentLabel === 'fragment' ? 'Updated fragment' : `Updated fragment ${fragmentLabel}`;
      return (
        join(
          updatedLabel,
          revision ? `rev ${revision}` : undefined,
          user ? `by ${user}` : undefined,
          length ? `${length.toLocaleString()} chars` : undefined,
          changes ? `changes: ${changes}` : undefined
        ) || 'Updated fragment'
      );
    }
    case 'fragment_deleted': {
      return (
        join(
          fragmentLabel === 'fragment' ? 'Deleted fragment' : `Deleted fragment ${fragmentLabel}`,
          user ? `by ${user}` : undefined
        ) || 'Deleted fragment'
      );
    }
    case 'fragment_revision_created': {
      const revisionNumberValue = getNumber('revision_number');
      const revisionIdValue = getString('revision_id');
      const message = getString('message');
      const author = getString('author');
      const contentHash = getString('content_hash');
      return (
        join(
          fragmentLabel === 'fragment'
            ? 'Saved fragment revision'
            : `Saved revision for ${fragmentLabel}`,
          revisionNumberValue !== undefined
            ? `rev ${revisionNumberValue}`
            : revisionIdValue
              ? `rev ${toShortId(revisionIdValue)}`
              : undefined,
          author ? `by ${author}` : user ? `by ${user}` : undefined,
          message,
          contentHash ? `hash ${toShortId(contentHash)}` : undefined
        ) || 'Fragment revision created'
      );
    }
    case 'validation_started': {
      const count = getNumber('fragment_count');
      return (
        join(
          'Validation started',
          count !== undefined ? `${count} fragment${count === 1 ? '' : 's'}` : undefined,
          user ? `by ${user}` : undefined
        ) || 'Validation started'
      );
    }
    case 'validation_completed': {
      const errors = getNumber('error_count');
      const warnings = getNumber('warning_count');
      const specHash = getString('spec_hash');
      const duration = formatDuration(getNumber('duration_ms'));
      return (
        join(
          errors
            ? `${errors} error${errors === 1 ? '' : 's'}`
            : 'Validation completed without errors',
          warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : undefined,
          specHash ? `spec ${toShortId(specHash)}` : undefined,
          duration ? `in ${duration}` : undefined,
          user ? `by ${user}` : undefined
        ) || 'Validation completed'
      );
    }
    case 'validation_failed': {
      const specHash = getString('spec_hash');
      const failureReason = getString('failure_reason');
      const errors = getNumber('error_count');
      const warnings = getNumber('warning_count');
      return (
        join(
          'Validation failed',
          specHash ? `spec ${toShortId(specHash)}` : undefined,
          failureReason,
          errors ? `${errors} errors` : undefined,
          warnings ? `${warnings} warnings` : undefined,
          user ? `by ${user}` : undefined
        ) || 'Validation failed'
      );
    }
    case 'version_frozen': {
      const versionName = getString('version_name');
      const versionId = getString('version_id');
      const description = getString('description');
      const specHash = getString('spec_hash');
      return (
        join(
          versionName ? `Frozen version "${versionName}"` : 'Version frozen',
          versionId ? `id ${toShortId(versionId)}` : undefined,
          specHash ? `spec ${toShortId(specHash)}` : undefined,
          description,
          user ? `by ${user}` : undefined
        ) || 'Version frozen'
      );
    }
    case 'webhook_received': {
      const provider = getString('provider');
      const repo = getString('repository');
      const ref = getString('ref');
      const eventName = getString('event_type');
      const actions = getArray('actions');
      return (
        join(
          `Received ${provider ?? 'webhook'}${eventName ? ` ${eventName}` : ''}`,
          repo ? `for ${repo}` : undefined,
          ref ? `ref ${ref.split('/').pop() ?? ref}` : undefined,
          actions.length
            ? `actions: ${actions.slice(0, 2).map(formatValue).join(', ')}${
                actions.length > 2 ? ` +${actions.length - 2}` : ''
              }`
            : undefined
        ) || 'Received webhook'
      );
    }
    case 'handler_executed': {
      const handlerName =
        getString('handlerName') ?? getString('handler') ?? toShortId(getString('handlerId'));
      const success = data.success === true;
      const message = getString('message');
      const duration = formatDuration(getNumber('duration'));
      const actions = getArray('actions');
      return (
        join(
          handlerName
            ? `${handlerName} ${success ? 'succeeded' : 'failed'}`
            : `Handler ${success ? 'succeeded' : 'failed'}`,
          message,
          actions.length
            ? `actions: ${actions.slice(0, 2).map(formatValue).join(', ')}${
                actions.length > 2 ? ` +${actions.length - 2}` : ''
              }`
            : undefined,
          duration ? `in ${duration}` : undefined
        ) || 'Handler executed'
      );
    }
    case 'git_push_processed': {
      const commits = getNumber('commits');
      const ref = getString('ref');
      const repository = getString('repository');
      const provider = getString('provider');
      return (
        join(
          `Processed ${commits ?? 0} commit${commits === 1 ? '' : 's'}`,
          ref ? `on ${ref}` : undefined,
          repository ? `repo ${repository}` : undefined,
          provider ? `via ${provider}` : undefined
        ) || 'Processed git push'
      );
    }
    case 'git_merge_processed': {
      const action = getString('action');
      const source = getString('head_branch');
      const target = getString('base_branch');
      const provider = getString('provider');
      const pr = getString('pr_id');
      return (
        join(
          action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} merge` : 'Merge processed',
          source && target ? `${source} → ${target}` : undefined,
          pr ? `PR ${toShortId(pr)}` : undefined,
          provider ? `via ${provider}` : undefined
        ) || 'Processed merge event'
      );
    }
    case 'event_head_updated': {
      const headId = getString('head_event_id');
      const headSummary =
        describeEventLike(data.head_event, headId ?? undefined) ??
        describeById(headId) ??
        (headId ? toShortId(headId) : undefined);
      const base = headSummary
        ? `Head set to "${headSummary}"`
        : headId
          ? `Head set to ${toShortId(headId)}`
          : 'Head updated';
      const reactivated = getArray('reactivated_event_ids').length;
      const deactivated = getArray('deactivated_event_ids').length;
      return (
        join(
          base,
          reactivated ? `re-activated ${reactivated}` : undefined,
          deactivated ? `deactivated ${deactivated}` : undefined
        ) || base
      );
    }
    case 'events_reverted': {
      const revertedIds = getArray('reverted_event_ids').map(id => String(id));
      const headId = getString('head_event_id');
      const described = revertedIds
        .map(id => describeById(id))
        .filter((value): value is string => Boolean(value));
      let description: string;
      if (described.length === 1) {
        description = `Reverted "${described[0]}"`;
      } else if (described.length > 1) {
        const preview = described
          .slice(0, 2)
          .map(item => `"${item}"`)
          .join(', ');
        const suffix = described.length > 2 ? ` +${described.length - 2} more` : '';
        description = `Reverted ${revertedIds.length} events (${preview}${suffix})`;
      } else {
        description =
          join(
            `Reverted ${revertedIds.length} event${revertedIds.length === 1 ? '' : 's'}`,
            revertedIds.length
              ? `(${revertedIds
                  .slice(0, 2)
                  .map(id => toShortId(String(id)))
                  .join(', ')}${revertedIds.length > 2 ? '…' : ''})`
              : undefined
          ) || 'Events reverted';
      }
      return headId ? `${description} · head now ${toShortId(headId)}` : description;
    }
    case 'events_reapplied': {
      const reappliedIds = getArray('reapplied_event_ids').map(id => String(id));
      if (reappliedIds.length === 0) {
        reappliedIds.push(...getArray('reactivated_event_ids').map(id => String(id)));
      }
      const described = reappliedIds
        .map(id => describeById(id))
        .filter((value): value is string => Boolean(value));
      if (described.length === 1) {
        return `Reapplied "${described[0]}"`;
      }
      if (described.length > 1) {
        const preview = described
          .slice(0, 2)
          .map(item => `"${item}"`)
          .join(', ');
        const suffix = described.length > 2 ? ` +${described.length - 2} more` : '';
        return `Reapplied ${reappliedIds.length} events (${preview}${suffix})`;
      }
      return (
        join(
          `Reapplied ${reappliedIds.length} event${reappliedIds.length === 1 ? '' : 's'}`,
          reappliedIds.length
            ? `(${reappliedIds
                .slice(0, 2)
                .map(id => toShortId(String(id)))
                .join(', ')}${reappliedIds.length > 2 ? '…' : ''})`
            : undefined
        ) || 'Events reapplied'
      );
    }
    case 'entity_created': {
      const entityType = getString('entity_type') ?? getString('artifact_type');
      const name = getString('name');
      const values =
        data.values && typeof data.values === 'object' ? formatValue(data.values) : undefined;
      return (
        join(
          entityType ? `Added ${humanizeKey(entityType)}` : 'Entity created',
          name ? `"${name}"` : undefined,
          values ? `values: ${values}` : undefined
        ) || 'Entity created'
      );
    }
    case 'entity_deleted': {
      const entityType = getString('entity_type') ?? getString('artifact_type');
      const name = getString('name');
      const reason = getString('reason') ?? getString('source');
      return (
        join(
          entityType ? `Removed ${humanizeKey(entityType)}` : 'Entity deleted',
          name ? `"${name}"` : undefined,
          reason ? `(${reason})` : undefined
        ) || 'Entity deleted'
      );
    }
    case 'entity_restored': {
      const entityType = getString('entity_type') ?? getString('artifact_type');
      const name = getString('name');
      const sourceEvent = getString('restored_from_event_id');
      return (
        join(
          entityType ? `Restored ${humanizeKey(entityType)}` : 'Entity restored',
          name ? `"${name}"` : undefined,
          sourceEvent ? `from ${toShortId(sourceEvent) ?? sourceEvent}` : undefined
        ) || 'Entity restored'
      );
    }
    default:
      return summarizeGeneric(data);
  }
};

type EventTargetInfo = {
  key: string;
  label: string;
  description?: string;
};

type EventGroup = {
  target: EventTargetInfo;
  current: Event;
  previous: Event[];
};

const coerceToString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
};

const getEventTargetInfo = (
  event: Event,
  context: { lookupEvent?: (eventId: string) => Event | undefined; seen?: Set<string> } = {}
): EventTargetInfo => {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const { lookupEvent } = context;
  const seen = context.seen ?? new Set<string>();
  if (seen.has(event.id)) {
    return {
      key: `event:${event.id}`,
      label: humanizeKey(event.event_type),
    } satisfies EventTargetInfo;
  }
  seen.add(event.id);
  const takeString = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const candidate = coerceToString(data[key]);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  };
  const capitalize = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : undefined;
  const getArray = (key: string): unknown[] =>
    Array.isArray(data[key]) ? (data[key] as unknown[]) : [];

  const resolveFromEventIds = (ids: unknown[]): EventTargetInfo | null => {
    if (!lookupEvent) return null;
    for (const value of ids) {
      const id = coerceToString(value);
      if (!id) continue;
      const referenced = lookupEvent(id);
      if (referenced) {
        return getEventTargetInfo(referenced, { lookupEvent, seen });
      }
    }
    return null;
  };

  const resolveFromEventLike = (value: unknown, fallbackId: string): EventTargetInfo | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Partial<Event> & Record<string, unknown>;
    const type = raw.event_type;
    if (!type || typeof type !== 'string') return null;
    const normalized: Event = {
      id: String(raw.id ?? fallbackId),
      project_id: String(raw.project_id ?? event.project_id),
      event_type: type as Event['event_type'],
      data: raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {},
      is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
      reverted_at: typeof raw.reverted_at === 'string' ? raw.reverted_at : null,
      created_at: typeof raw.created_at === 'string' ? raw.created_at : event.created_at,
    };
    return getEventTargetInfo(normalized, { lookupEvent, seen });
  };

  const resolveFromEventArray = (values: unknown[], prefix: string): EventTargetInfo | null => {
    for (let index = 0; index < values.length; index += 1) {
      const entry = resolveFromEventLike(values[index], `${event.id}-${prefix}-${index}`);
      if (entry) {
        return entry;
      }
    }
    return null;
  };

  const timelineTarget = (description: string): EventTargetInfo => ({
    key: `timeline:${event.event_type}`,
    label: 'Timeline update',
    description,
  });

  switch (event.event_type) {
    case 'fragment_created':
    case 'fragment_updated':
    case 'fragment_deleted':
    case 'fragment_revision_created': {
      const fragmentId = takeString('fragment_id', 'fragmentId', 'id');
      const fragmentPath = takeString('fragment_path', 'path');
      const revisionId = takeString('revision_id', 'revisionId');
      const revisionNumber = takeString('revision_number', 'revisionNumber');
      const label =
        fragmentPath ??
        (fragmentId ? `Fragment ${toShortId(fragmentId) ?? fragmentId}` : 'Fragment');
      const descriptionParts: string[] = [];
      if (fragmentId) {
        descriptionParts.push(`ID ${toShortId(fragmentId) ?? fragmentId}`);
      }
      if (revisionNumber) {
        descriptionParts.push(`Rev ${revisionNumber}`);
      } else if (revisionId) {
        descriptionParts.push(`Revision ${toShortId(revisionId) ?? revisionId}`);
      }
      return {
        key: `fragment:${fragmentId ?? fragmentPath ?? event.event_type}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'validation_started':
    case 'validation_completed':
    case 'validation_failed': {
      const validationId = takeString('validation_id', 'validationId');
      const specHash = takeString('spec_hash', 'specHash');
      const fragmentCount = takeString('fragment_count', 'fragmentCount');
      const label = validationId
        ? `Validation ${toShortId(validationId) ?? validationId}`
        : specHash
          ? `Validation ${toShortId(specHash) ?? specHash}`
          : 'Validation run';
      const descriptionParts: string[] = [];
      if (fragmentCount) {
        descriptionParts.push(`${fragmentCount} fragment${fragmentCount === '1' ? '' : 's'}`);
      }
      if (specHash) {
        descriptionParts.push(`Spec ${toShortId(specHash) ?? specHash}`);
      }
      return {
        key: `validation:${validationId ?? specHash ?? 'general'}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'version_frozen': {
      const versionId = takeString('version_id', 'versionId');
      const versionName = takeString('version_name', 'versionName');
      const specHash = takeString('spec_hash', 'specHash');
      const label =
        versionName ??
        (versionId ? `Version ${toShortId(versionId) ?? versionId}` : 'Version frozen');
      const descriptionParts: string[] = [];
      if (versionId) {
        descriptionParts.push(`ID ${toShortId(versionId) ?? versionId}`);
      }
      if (specHash) {
        descriptionParts.push(`Spec ${toShortId(specHash) ?? specHash}`);
      }
      return {
        key: `version:${versionId ?? versionName ?? 'frozen'}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'webhook_received': {
      const webhookId = takeString('webhook_id', 'webhookId', 'id');
      const provider = takeString('provider');
      const repository = takeString('repository', 'repo');
      const eventName = takeString('event_type', 'eventType');
      const providerName = capitalize(provider);
      const label = providerName ? `${providerName} webhook` : 'Webhook';
      const descriptionParts = [repository, eventName ? humanizeKey(eventName) : undefined].filter(
        (value): value is string => Boolean(value)
      );
      const fallbackKey =
        [provider, repository].filter((value): value is string => Boolean(value)).join(':') ||
        'general';
      const keyBase = webhookId ?? fallbackKey;
      return {
        key: `webhook:${keyBase}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'handler_executed': {
      const handlerId = takeString('handler_id', 'handlerId');
      const handlerName = takeString('handler_name', 'handlerName', 'handler');
      const label =
        handlerName ?? (handlerId ? `Handler ${toShortId(handlerId) ?? handlerId}` : 'Handler');
      const description = handlerId ? `ID ${toShortId(handlerId) ?? handlerId}` : undefined;
      return {
        key: `handler:${handlerId ?? handlerName ?? 'execution'}`,
        label,
        description,
      } satisfies EventTargetInfo;
    }
    case 'git_push_processed': {
      const repository = takeString('repository');
      const branch = takeString('branch', 'ref');
      const provider = takeString('provider');
      const branchLabel = branch ? (branch.split('/').pop() ?? branch) : undefined;
      const label = repository ? `Push · ${repository}` : 'Git push';
      const descriptionParts = [
        branchLabel ? `Branch ${branchLabel}` : undefined,
        provider ? `via ${provider}` : undefined,
      ].filter((value): value is string => Boolean(value));
      return {
        key: `git-push:${repository ?? 'unknown'}:${branch ?? 'general'}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'git_merge_processed': {
      const repository = takeString('repository');
      const source = takeString('source_branch', 'head_branch');
      const target = takeString('target_branch', 'base_branch');
      const provider = takeString('provider');
      const label = repository ? `Merge · ${repository}` : 'Git merge';
      const branches = source && target ? `${source} → ${target}` : undefined;
      const descriptionParts = [branches, provider ? `via ${provider}` : undefined].filter(
        (value): value is string => Boolean(value)
      );
      return {
        key: `git-merge:${repository ?? 'unknown'}:${target ?? 'general'}`,
        label,
        description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
      } satisfies EventTargetInfo;
    }
    case 'event_head_updated': {
      const headId = takeString('head_event_id');
      const resolved =
        (headId && resolveFromEventIds([headId])) ||
        resolveFromEventLike(data.head_event, `${event.id}-head`);

      if (resolved) {
        return resolved;
      }

      return timelineTarget('Head updated');
    }
    case 'events_reverted': {
      const resolved =
        resolveFromEventIds(getArray('reverted_event_ids')) ||
        resolveFromEventIds(getArray('reactivated_event_ids')) ||
        resolveFromEventLike(data.reverted_event, `${event.id}-reverted`) ||
        resolveFromEventArray(getArray('reverted_events'), 'reverted');

      if (resolved) {
        return resolved;
      }

      return timelineTarget('Events reverted');
    }
    case 'events_reapplied': {
      const resolved =
        resolveFromEventIds(getArray('reapplied_event_ids')) ||
        resolveFromEventIds(getArray('reactivated_event_ids')) ||
        resolveFromEventLike(data.reapplied_event, `${event.id}-reapplied`) ||
        resolveFromEventArray(getArray('reapplied_events'), 'reapplied');

      if (resolved) {
        return resolved;
      }

      return timelineTarget('Events reapplied');
    }
    case 'entity_created': {
      const entityType = takeString('entity_type', 'artifact_type');
      const name = takeString('name');
      const entityId = takeString('entity_id', 'id');
      const baseLabel = entityType ? humanizeKey(entityType) : 'Entity';
      const label = name ? `${baseLabel}: ${name}` : `${baseLabel} created`;
      const description = entityId ? `ID ${toShortId(entityId) ?? entityId}` : undefined;
      return {
        key: `entity:${entityType ?? 'generic'}:${entityId ?? name ?? 'created'}`,
        label,
        description,
      } satisfies EventTargetInfo;
    }
    case 'entity_deleted': {
      const entityType = takeString('entity_type', 'artifact_type');
      const name = takeString('name');
      const entityId = takeString('entity_id', 'id');
      const baseLabel = entityType ? humanizeKey(entityType) : 'Entity';
      const label = name ? `${baseLabel}: ${name}` : `${baseLabel} deleted`;
      const description = entityId ? `ID ${toShortId(entityId) ?? entityId}` : undefined;
      return {
        key: `entity:${entityType ?? 'generic'}:${entityId ?? name ?? 'deleted'}`,
        label,
        description,
      } satisfies EventTargetInfo;
    }
    case 'entity_restored': {
      const entityType = takeString('entity_type', 'artifact_type');
      const name = takeString('name');
      const entityId = takeString('entity_id', 'id');
      const baseLabel = entityType ? humanizeKey(entityType) : 'Entity';
      const label = name ? `${baseLabel}: ${name}` : `${baseLabel} restored`;
      const description = entityId ? `ID ${toShortId(entityId) ?? entityId}` : undefined;
      return {
        key: `entity:${entityType ?? 'generic'}:${entityId ?? name ?? 'restored'}`,
        label,
        description,
      } satisfies EventTargetInfo;
    }
    default:
      break;
  }

  return {
    key: `event-type:${event.event_type}`,
    label: humanizeKey(event.event_type),
  } satisfies EventTargetInfo;
};

const extractDetailRows = (event: Event): DetailRow[] => {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const rows: DetailRow[] = [];

  const addRow = (label: string, value: unknown) => {
    const formatted = formatValue(value);
    if (!label || !formatted || formatted === 'n/a') return;
    rows.push({ label: emphasizeLabel(label), value: formatted });
  };

  const addFromValues = (values: unknown, prefix?: string) => {
    if (!values || typeof values !== 'object') return;
    Object.entries(values as Record<string, unknown>).forEach(([key, val]) => {
      addRow(prefix ? `${prefix} ${key}` : key, val);
    });
  };

  const changes = data.changes;
  if (changes && typeof changes === 'object') {
    Object.entries(changes as Record<string, unknown>).forEach(([key, change]) => {
      if (
        change &&
        typeof change === 'object' &&
        'before' in (change as Record<string, unknown>) &&
        'after' in (change as Record<string, unknown>)
      ) {
        const entry = change as { before: unknown; after: unknown };
        const before = formatValue(entry.before);
        const after = formatValue(entry.after);
        rows.push({ label: emphasizeLabel(key), value: `${before} → ${after}` });
      } else {
        addRow(key, change);
      }
    });
  }

  if (rows.length === 0 && data.values && typeof data.values === 'object') {
    addFromValues(data.values);
  }

  const importantKeys = [
    'name',
    'path',
    'fragment_path',
    'fragment_id',
    'entity_id',
    'artifact_id',
    'entity_type',
    'artifact_type',
    'restored_from_event_id',
    'deleted_at',
    'restored_at',
    'user',
    'user_id',
    'author',
    'description',
    'status',
  ];

  importantKeys.forEach(key => {
    if (key in data) {
      addRow(key, data[key]);
    }
  });

  return rows;
};

type EventCardProps = {
  event: Event;
  variant: 'root' | 'child';
  lookupEvent: (eventId: string) => Event | undefined;
  targetLabel?: string;
  targetDescription?: string;
  orderLabel?: string;
  history?: Event[];
  isExpanded?: boolean;
  onToggleHistory?: () => void;
  onRestore?: (event: Event) => void;
  isRestoring?: boolean;
};

function EventCard({
  event,
  variant,
  lookupEvent,
  targetLabel,
  targetDescription,
  orderLabel,
  history,
  isExpanded,
  onToggleHistory,
  onRestore,
  isRestoring,
}: EventCardProps) {
  const detailRows = useMemo(() => extractDetailRows(event), [event]);
  const summary = useMemo(() => formatEventSummary(event, lookupEvent), [event, lookupEvent]);

  const isHistorical = variant === 'child';
  const normalizedType = event.event_type.toLowerCase();
  const isInactive = !event.is_active;
  const isReversionType = normalizedType.includes('revert');
  const showRevertedContainer = isInactive || isReversionType;
  const canRestore =
    !showRevertedContainer &&
    variant === 'root' &&
    event.event_type === 'entity_deleted' &&
    typeof onRestore === 'function';
  const isRestoreInFlight = Boolean(isRestoring);

  const statusLabel = isHistorical ? 'Historical' : isInactive ? 'Reverted' : 'Active';
  const statusClasses = isHistorical
    ? 'bg-slate-200 text-slate-700 dark:bg-graphite-800 dark:text-graphite-200'
    : isInactive
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
      : 'bg-green-100 text-green-700 dark:bg-emerald-500/20 dark:text-emerald-200';

  const containerClasses = [
    'rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow',
    'dark:border-graphite-700 dark:bg-graphite-900 dark:shadow-none',
    variant === 'child'
      ? 'border-dashed bg-slate-50/70 p-3 dark:border-graphite-700 dark:bg-graphite-900/60'
      : 'p-4',
  ]
    .filter(Boolean)
    .join(' ');

  const revertedWrapperClasses = [
    'rounded-xl border border-amber-300 bg-amber-50/60 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10',
    variant === 'child' ? 'p-3' : 'p-4',
  ]
    .filter(Boolean)
    .join(' ');

  const iconSizeClass = variant === 'child' ? 'h-4 w-4' : 'h-5 w-5';
  const iconWrapperClasses = [
    'flex items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-graphite-800 dark:text-graphite-200',
    variant === 'child' ? 'mt-0.5 h-7 w-7' : 'mt-1 h-8 w-8',
  ]
    .filter(Boolean)
    .join(' ');

  const historyCount = history?.length ?? 0;
  const totalStates = historyCount + 1;
  const stackLabel =
    variant === 'root' && totalStates > 1
      ? `Stack · ${totalStates} state${totalStates === 1 ? '' : 's'}`
      : undefined;

  const icon = useMemo(() => {
    if (isInactive || isReversionType) {
      return <RotateCcw className={`${iconSizeClass} text-amber-500`} />;
    }
    if (normalizedType.includes('restored')) {
      return <RotateCcw className={`${iconSizeClass} text-emerald-500`} />;
    }
    if (normalizedType.includes('created')) {
      return <PlusCircle className={`${iconSizeClass} text-emerald-500`} />;
    }
    if (normalizedType.includes('updated') || normalizedType.includes('revision')) {
      return <Pencil className={`${iconSizeClass} text-blue-500`} />;
    }
    if (normalizedType.includes('deleted')) {
      return <Trash2 className={`${iconSizeClass} text-rose-500`} />;
    }
    return <Info className={`${iconSizeClass} text-slate-400`} />;
  }, [iconSizeClass, isInactive, isReversionType, normalizedType]);

  const nestedRevertedEvent = useMemo(() => {
    if (!showRevertedContainer) return null;

    const data = (event.data ?? {}) as Record<string, unknown>;

    const normalizeEventLike = (value: unknown, suffix: string): Event | null => {
      if (!value || typeof value !== 'object') return null;
      const raw = value as Partial<Event> & Record<string, unknown>;
      const eventType =
        typeof raw.event_type === 'string'
          ? (raw.event_type as Event['event_type'])
          : event.event_type;
      return {
        id: String(raw.id ?? `${event.id}-${suffix}`),
        project_id: String(raw.project_id ?? event.project_id),
        event_type: eventType,
        data: raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {},
        is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
        reverted_at: typeof raw.reverted_at === 'string' ? raw.reverted_at : null,
        created_at: typeof raw.created_at === 'string' ? raw.created_at : event.created_at,
      } satisfies Event;
    };

    const fromIds = (value: unknown): Event | null => {
      if (!Array.isArray(value) || !lookupEvent) return null;
      for (const entry of value) {
        const id = coerceToString(entry);
        if (!id) continue;
        const resolved = lookupEvent(id);
        if (resolved) return resolved;
      }
      return null;
    };

    const candidate =
      normalizeEventLike(data.reverted_event, 'reverted') ||
      normalizeEventLike(data.reapplied_event, 'reapplied') ||
      normalizeEventLike(data.head_event, 'head') ||
      (Array.isArray(data.reverted_events)
        ? normalizeEventLike(data.reverted_events[0], 'reverted-array')
        : null) ||
      (Array.isArray(data.reapplied_events)
        ? normalizeEventLike(data.reapplied_events[0], 'reapplied-array')
        : null) ||
      fromIds(data.reverted_event_ids) ||
      fromIds(data.reapplied_event_ids) ||
      fromIds(data.reactivated_event_ids);

    if (candidate && candidate.id === event.id) {
      return null;
    }

    return candidate ?? null;
  }, [event, lookupEvent, showRevertedContainer]);

  const hasDetailRows = detailRows.length > 0;
  const shouldShowSummary = !hasDetailRows && !nestedRevertedEvent && summary;

  const renderDetailRows = () => {
    if (!hasDetailRows) {
      return shouldShowSummary ? (
        <div className="rounded border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-graphite-700 dark:bg-graphite-900 dark:text-graphite-100">
          {summary}
        </div>
      ) : null;
    }

    return (
      <dl className="grid gap-x-8 gap-y-3 text-sm text-gray-700 dark:text-graphite-100 sm:grid-cols-2">
        {detailRows.map((row, index) => (
          <div key={`${row.label}-${row.value}-${index}`} className="flex items-start gap-3">
            <dt className="mt-0.5 w-28 shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-graphite-400">
              {row.label}
            </dt>
            <dd className="flex-1 font-semibold text-gray-900 dark:text-graphite-50">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  };

  const restoreButton = canRestore ? (
    <button
      type="button"
      onClick={eventObj => {
        eventObj.stopPropagation();
        onRestore?.(event);
      }}
      disabled={isRestoreInFlight}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400/60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
    >
      <RotateCcw className="h-3 w-3" />
      {isRestoreInFlight ? 'Restoring…' : 'Restore'}
    </button>
  ) : null;

  const historyToggle =
    historyCount > 0 && onToggleHistory ? (
      <button
        type="button"
        className="mt-0.5 rounded border border-transparent p-1 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring dark:text-graphite-300 dark:hover:bg-graphite-800"
        onClick={onToggleHistory}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse previous states' : 'Expand previous states'}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    ) : null;
  const historyToggleAdornment = historyToggle ?? <div className="mt-0.5 h-4 w-4" />;

  const historyContent =
    historyCount > 0 && isExpanded ? (
      <div className="mt-4 space-y-3 border-t border-dashed border-gray-200 pt-4 dark:border-graphite-700">
        {(history ?? []).map((historyEvent, index) => (
          <EventCard
            key={historyEvent.id}
            event={historyEvent}
            variant="child"
            lookupEvent={lookupEvent}
            orderLabel={`State ${index + 2}/${totalStates}`}
          />
        ))}
      </div>
    ) : null;

  const nestedContent =
    showRevertedContainer && nestedRevertedEvent && variant === 'root' ? (
      <div className="mt-3 space-y-3 border-l border-amber-300/60 pl-3 dark:border-amber-500/30">
        <EventCard event={nestedRevertedEvent} variant="child" lookupEvent={lookupEvent} />
      </div>
    ) : null;

  return (
    <div
      className={[
        showRevertedContainer ? revertedWrapperClasses : '',
        !showRevertedContainer ? containerClasses : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showRevertedContainer ? (
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <span>Reverted</span>
          {event.reverted_at ? (
            <span className="font-normal normal-case text-amber-600 dark:text-amber-200">
              {new Date(event.reverted_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={showRevertedContainer ? containerClasses : undefined}>
        {targetLabel ? (
          <div className="mb-3 flex items-start gap-2">
            {historyToggleAdornment}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-graphite-50">
                  {targetLabel}
                </span>
                {stackLabel ? (
                  <span className="text-xs font-medium text-gray-500 dark:text-graphite-400">
                    {stackLabel}
                  </span>
                ) : null}
              </div>
              {targetDescription ? (
                <div className="text-xs text-gray-500 dark:text-graphite-300">
                  {targetDescription}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={
            targetLabel
              ? 'border-t border-dashed border-gray-200 pt-3 dark:border-graphite-700'
              : undefined
          }
        >
          <div className="flex items-start gap-3">
            <div className={iconWrapperClasses}>{icon}</div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-graphite-50">
                  {humanizeKey(event.event_type)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}
                >
                  {statusLabel}
                </span>
                {orderLabel ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-graphite-800/80 dark:text-graphite-200">
                    {orderLabel}
                  </span>
                ) : null}
                {restoreButton}
              </div>
              <div className="text-xs text-gray-500 dark:text-graphite-300">
                {new Date(event.created_at).toLocaleString()}
              </div>
              {renderDetailRows()}
            </div>
          </div>
          {nestedContent}
          {historyContent}
        </div>
      </div>
    </div>
  );
}

type EventGroupCardProps = {
  group: EventGroup;
  expanded: boolean;
  onToggle: () => void;
  lookupEvent: (eventId: string) => Event | undefined;
  onRestore?: (event: Event) => void;
  restoringEvents?: Set<string>;
};

function EventGroupCard({
  group,
  expanded,
  onToggle,
  lookupEvent,
  onRestore,
  restoringEvents,
}: EventGroupCardProps) {
  const { current, previous, target } = group;
  const totalStates = previous.length + 1;
  const isRestoring = restoringEvents?.has(current.id) ?? false;
  const restoreHandler =
    current.event_type === 'entity_deleted' && typeof onRestore === 'function'
      ? onRestore
      : undefined;

  return (
    <EventCard
      event={current}
      variant="root"
      lookupEvent={lookupEvent}
      targetLabel={target.label}
      targetDescription={target.description}
      orderLabel={totalStates > 1 ? `Current state · 1/${totalStates}` : 'Current state'}
      history={previous}
      isExpanded={expanded}
      onToggleHistory={previous.length > 0 ? onToggle : undefined}
      onRestore={restoreHandler}
      isRestoring={isRestoring}
    />
  );
}

export function EventsReport({ projectId }: EventsReportProps) {
  const { data, isLoading, isError, refetch } = useProjectEvents(projectId);
  const { lastMessage } = useWebSocket(projectId, { autoReconnect: true });

  const [eventLog, setEventLog] = useState<Event[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [restoringEvents, setRestoringEvents] = useState<Set<string>>(new Set());
  const updateRestoringEvents = useCallback((eventId: string, shouldAdd: boolean) => {
    setRestoringEvents(prev => {
      const next = new Set(prev);
      if (shouldAdd) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }
      return next;
    });
  }, []);

  const eventById = useMemo(() => {
    const map = new Map<string, Event>();
    eventLog.forEach(item => map.set(item.id, item));
    return map;
  }, [eventLog]);

  const lookupEvent = useCallback((eventId: string) => eventById.get(eventId), [eventById]);

  useEffect(() => {
    if (!Array.isArray(data?.events)) return;

    setEventLog(prev => {
      const merged = new Map<string, Event>();
      data.events.forEach(event => merged.set(event.id, event));
      prev.forEach(event => {
        if (!merged.has(event.id)) {
          merged.set(event.id, event);
        }
      });
      return sortEventsDesc(Array.from(merged.values()));
    });
  }, [data]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'event') return;

    const payloadCandidate =
      (lastMessage as { payload?: unknown }).payload ?? (lastMessage as { data?: unknown }).data;

    if (!payloadCandidate || typeof payloadCandidate !== 'object') {
      return;
    }

    const payload = payloadCandidate as Record<string, unknown>;
    const readString = (key: string): string | undefined => coerceToString(payload[key]);

    const eventProjectIdValue =
      readString('project_id') ??
      readString('projectId') ??
      coerceToString((lastMessage as unknown as Record<string, unknown>).projectId);

    if (eventProjectIdValue && projectId && eventProjectIdValue !== projectId) {
      return;
    }

    const eventId = readString('id');
    const eventType = readString('event_type') ?? readString('type');
    if (!eventId || !eventType) {
      return;
    }

    const createdAt =
      readString('created_at') ?? readString('timestamp') ?? new Date().toISOString();

    const rawData = payload['data'];
    const isActiveRaw = payload['is_active'];
    const revertedAtRaw = payload['reverted_at'];

    const eventData: Event = {
      id: eventId,
      project_id: String(eventProjectIdValue ?? projectId),
      event_type: eventType as Event['event_type'],
      data: rawData && typeof rawData === 'object' ? (rawData as Record<string, unknown>) : {},
      is_active:
        typeof isActiveRaw === 'boolean'
          ? isActiveRaw
          : typeof isActiveRaw === 'string'
            ? isActiveRaw === 'true'
            : true,
      reverted_at: typeof revertedAtRaw === 'string' && revertedAtRaw.trim() ? revertedAtRaw : null,
      created_at: createdAt,
    };

    setEventLog(prev => {
      let updated = prev;
      if (eventData.event_type === 'entity_restored') {
        const restoredFromId = coerceToString(eventData.data?.restored_from_event_id);
        if (restoredFromId) {
          updated = prev.map(item =>
            item.id === restoredFromId ? { ...item, is_active: false } : item
          );
        }
      }
      if (updated.some(event => event.id === eventId)) {
        return sortEventsDesc(updated);
      }
      return sortEventsDesc([eventData, ...updated]);
    });

    refetch();
  }, [lastMessage, projectId, refetch]);

  const groupedEvents = useMemo(() => {
    const lookupFromMap = (eventId: string) => eventById.get(eventId);
    const groups = new Map<string, Event[]>();

    eventLog.forEach(event => {
      const target = getEventTargetInfo(event, { lookupEvent: lookupFromMap });
      const existing = groups.get(target.key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(target.key, [event]);
      }
    });

    return Array.from(groups.entries())
      .map(([, events]) => {
        const sorted = [...events].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const current = sorted.find(item => item.is_active) ?? sorted[0];
        const previous = sorted.filter(item => item.id !== current.id);
        return {
          target: getEventTargetInfo(current, { lookupEvent: lookupFromMap }),
          current,
          previous,
        } satisfies EventGroup;
      })
      .sort(
        (a, b) =>
          new Date(b.current.created_at).getTime() - new Date(a.current.created_at).getTime()
      );
  }, [eventById, eventLog]);

  useEffect(() => {
    const validKeys = new Set(
      groupedEvents.filter(group => group.previous.length > 0).map(group => group.target.key)
    );
    setExpandedGroups(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(key => {
        if (validKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [groupedEvents]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleRestoreEvent = useCallback(
    async (event: Event) => {
      const artifactId =
        coerceToString(event.data?.artifact_id) ?? coerceToString(event.data?.entity_id);
      const snapshot = event.data?.snapshot;
      if (!artifactId) {
        console.error(
          '[EventsReport] Unable to restore entity: missing artifact identifier',
          event
        );
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('Unable to restore entity: missing artifact identifier');
        }
        return;
      }
      if (!snapshot || typeof snapshot !== 'object') {
        console.error('[EventsReport] Unable to restore entity: missing snapshot payload', event);
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('Unable to restore entity: missing snapshot data');
        }
        return;
      }

      updateRestoringEvents(event.id, true);
      try {
        await apiService.restoreProjectEntity(projectId, artifactId, {
          snapshot: snapshot as Record<string, unknown>,
          eventId: event.id,
        });
        setEventLog(prev =>
          prev.map(item => (item.id === event.id ? { ...item, is_active: false } : item))
        );
        await refetch();
      } catch (error) {
        console.error('[EventsReport] Failed to restore entity', error);
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('Failed to restore entity. Please try again.');
        }
      } finally {
        updateRestoringEvents(event.id, false);
      }
    },
    [projectId, refetch, updateRestoringEvents]
  );

  const activeCount = useMemo(() => eventLog.filter(event => event.is_active).length, [eventLog]);
  const danglingCount = eventLog.length - activeCount;
  const stackCount = groupedEvents.length;

  if (isLoading && eventLog.length === 0) {
    return <div className="p-4 text-sm text-gray-500">Loading event log…</div>;
  }

  if ((isError && eventLog.length === 0) || (!data && eventLog.length === 0)) {
    return <div className="p-4 text-sm text-red-500">Failed to load events. Please retry.</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-gray-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-950">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-graphite-300">
          <span>
            Events: <strong>{eventLog.length}</strong>
          </span>
          <span>
            Active: <strong>{activeCount}</strong>
          </span>
          <span>
            Reverted: <strong>{danglingCount}</strong>
          </span>
          <span>
            Stacks: <strong>{stackCount}</strong>
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-graphite-400">
          Events are grouped by their target entity. Expand a stack to inspect previous states.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-graphite-950">
        {eventLog.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-graphite-400">
            No events recorded yet.
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {groupedEvents.map(group => (
              <EventGroupCard
                key={group.target.key}
                group={group}
                expanded={expandedGroups.has(group.target.key)}
                onToggle={() => toggleGroup(group.target.key)}
                lookupEvent={lookupEvent}
                onRestore={handleRestoreEvent}
                restoringEvents={restoringEvents}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
