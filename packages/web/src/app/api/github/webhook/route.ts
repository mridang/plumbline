/**
 * Where the GitHub App's webhook used to be. A webhook is its own protocol, not
 * a REST resource, so it moved to `/webhooks/github`. The old address is the one
 * registered with the GitHub App until its settings are changed, and GitHub does
 * not follow redirects for webhooks, so it still answers, with the same
 * handler. Remove this file once the webhook URL is changed.
 */

export { POST } from '@/app/webhooks/github/route';
