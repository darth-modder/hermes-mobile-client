/**
 * `/api/messaging/*`, `/api/pairing*`, `/api/webhooks*` REST helpers — ported
 * from `apps/desktop/src/api/messaging.ts` onto `src/net/http.ts` (see
 * `rest.ts`). No M09 sub-screen surfaces these (channels/webhooks belong to
 * M10 "management screens" per the tracker); this module exists so M10 can
 * consume it without re-porting, per the task list's explicit file mapping.
 */

import type {
  MessagingPlatformsResponse,
  MessagingPlatformTestResponse,
  MessagingPlatformUpdate,
  PairingResponse,
  PairingUser,
  WebhookCreatePayload,
  WebhookCreateResponse,
  WebhookEnableResponse,
  WebhooksResponse
} from '../upstream/types/hermes'

import { restRequest } from './rest'

export function getMessagingPlatforms(profile?: string): Promise<MessagingPlatformsResponse> {
  return restRequest<MessagingPlatformsResponse>('/api/messaging/platforms', { profile })
}

export function updateMessagingPlatform(
  platformId: string,
  body: MessagingPlatformUpdate,
  profile?: string
): Promise<{ ok: boolean; platform: string }> {
  return restRequest<{ ok: boolean; platform: string }>(`/api/messaging/platforms/${encodeURIComponent(platformId)}`, {
    body,
    method: 'PUT',
    profile
  })
}

export function testMessagingPlatform(platformId: string, profile?: string): Promise<MessagingPlatformTestResponse> {
  return restRequest<MessagingPlatformTestResponse>(`/api/messaging/platforms/${encodeURIComponent(platformId)}/test`, {
    method: 'POST',
    profile
  })
}

// -- Pairing (who may DM the bot) --------------------------------------------
// Unknown DMers get a one-time code and land in `pending` until an admin
// approves them. Approval grants on the row's `request_id`, never on the
// code: the code is the requester's proof the channel is theirs and is never
// returned by the API.

export function getPairing(profile?: string): Promise<PairingResponse> {
  return restRequest<PairingResponse>('/api/pairing', { profile })
}

export function approvePairing(
  platform: string,
  requestId: string,
  profile?: string
): Promise<{ ok: boolean; user: PairingUser }> {
  return restRequest<{ ok: boolean; user: PairingUser }>('/api/pairing/approve', {
    // These endpoints read the profile off the body, not the query string.
    body: { platform, profile, request_id: requestId },
    method: 'POST',
    profile
  })
}

export function revokePairing(platform: string, userId: string, profile?: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>('/api/pairing/revoke', {
    body: { platform, profile, user_id: userId },
    method: 'POST',
    profile
  })
}

// -- Webhooks (subscription CRUD) --------------------------------------------

export function getWebhooks(): Promise<WebhooksResponse> {
  return restRequest<WebhooksResponse>('/api/webhooks')
}

export function enableWebhooks(): Promise<WebhookEnableResponse> {
  return restRequest<WebhookEnableResponse>('/api/webhooks/enable', { method: 'POST' })
}

export function createWebhook(body: WebhookCreatePayload): Promise<WebhookCreateResponse> {
  return restRequest<WebhookCreateResponse>('/api/webhooks', { body, method: 'POST' })
}

export function deleteWebhook(name: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>(`/api/webhooks/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function setWebhookEnabled(
  name: string,
  enabled: boolean
): Promise<{ enabled: boolean; name: string; ok: boolean }> {
  return restRequest<{ enabled: boolean; name: string; ok: boolean }>(
    `/api/webhooks/${encodeURIComponent(name)}/enabled`,
    {
      body: { enabled },
      method: 'PUT'
    }
  )
}
