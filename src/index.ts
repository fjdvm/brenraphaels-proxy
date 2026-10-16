import { createApp, type Env } from './app.js'

const app = createApp({ fetch: (input, init) => fetch(input, init) })

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>
