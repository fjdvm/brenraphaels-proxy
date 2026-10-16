import { createApp, type Env } from './app.js'

/**
 * Routes calls for the notifications service through its service binding when one is configured:
 * Cloudflare does not let a Worker reach another Worker's workers.dev address in the same account.
 */
function outboundFetch(env: Env): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (env.NOTIFICATIONS && url.host === new URL(env.NOTIFICATIONS_URL).host) {
      return env.NOTIFICATIONS.fetch(input, init)
    }
    return fetch(input, init)
  }
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    createApp({ fetch: outboundFetch(env) }).fetch(request, env, ctx),
} satisfies ExportedHandler<Env>
