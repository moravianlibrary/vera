// The control endpoints, for development and tests only (docs/develop/engine.md, Control
// endpoints): reset to a seed, move the clock, read the outbox, run the due jobs. They are the
// engine's own, not VERA's API, so their shapes are here and not in the contract.

import { z } from "zod";
import { ClockError } from "./clock";
import type { Engine } from "./engine";
import { matchPath } from "./http/match";
import { fieldErrorsOf, problem } from "./http/problem";
import { outboxChannels } from "./outbox";
import { SeedNotFound } from "./seed";

export const controlPrefix = "/_engine";

const resetSchema = z.object({ seed: z.string().min(1).default("base") });

const clockSchema = z
  .object({
    at: z.iso.datetime({ offset: true }).optional(),
    advance: z
      .object({
        days: z.number().int().nonnegative().optional(),
        hours: z.number().int().nonnegative().optional(),
        minutes: z.number().int().nonnegative().optional(),
      })
      .optional(),
    frozen: z.boolean().optional(),
  })
  .refine((change) => !(change.at !== undefined && change.advance !== undefined), {
    message: "Set the clock or advance it, not both.",
  });

const outboxQuerySchema = z.object({ channel: z.enum(outboxChannels).optional() });

const minute = 60 * 1000;

export async function serveControl(request: Request, engine: Engine): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(controlPrefix.length);
  const is = (method: string, pattern: string) =>
    request.method === method && matchPath(pattern, path) !== null;

  try {
    if (is("POST", "/reset")) {
      const change = resetSchema.safeParse(await bodyOf(request));
      if (!change.success) {
        return invalid(change.error);
      }

      engine.reset(change.data.seed);
      return Response.json({ seed: change.data.seed, now: engine.clock.now().toISOString() });
    }

    if (is("POST", "/clock")) {
      const change = clockSchema.safeParse(await bodyOf(request));
      if (!change.success) {
        return invalid(change.error);
      }

      const { at, advance, frozen } = change.data;
      if (at !== undefined) {
        engine.clock.set(new Date(at));
      }
      if (advance !== undefined) {
        const { days = 0, hours = 0, minutes = 0 } = advance;
        engine.clock.advance(((days * 24 + hours) * 60 + minutes) * minute);
      }
      if (frozen === true) {
        engine.clock.freeze();
      }
      if (frozen === false) {
        engine.clock.unfreeze();
      }

      const report = engine.jobs.runDue();
      return Response.json({
        now: engine.clock.now().toISOString(),
        frozen: engine.clock.isFrozen(),
        ...report,
      });
    }

    if (is("GET", "/outbox")) {
      const query = outboxQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success) {
        return invalid(query.error);
      }

      return Response.json(engine.outbox.list(query.data.channel));
    }

    if (is("POST", "/jobs/run")) {
      return Response.json(engine.jobs.runDue());
    }
  } catch (error) {
    if (error instanceof SeedNotFound) {
      return problem(404, error.message);
    }
    if (error instanceof ClockError) {
      return problem(409, error.message, { code: "clock.backwards" });
    }
    if (error instanceof SyntaxError) {
      return problem(400, "The body is not JSON.");
    }
    throw error;
  }

  return problem(404, `No control endpoint answers ${request.method} ${path}.`);
}

// An empty body is an empty object, so `POST /_engine/reset` alone loads the base seed.
async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.text();
  return text.trim() === "" ? {} : JSON.parse(text);
}

function invalid(error: z.ZodError): Response {
  return problem(422, error.issues[0]?.message ?? "Not accepted", {
    errors: fieldErrorsOf(error.issues),
  });
}
