// The control endpoints, for development and tests only (docs/develop/engine.md, Control
// endpoints): reset to a seed, move the clock, read the outbox, run the due jobs. They are the
// engine's own, not VERA's API, so their shapes are here and not in the contract.

import { z } from "zod";
import { openSession, sessionCookie } from "./access/sessions";
import { ClockError } from "./clock";
import type { Engine } from "./engine";
import { matchPath } from "./http/match";
import { fieldErrorsOf, problem } from "./http/problem";
import { identityInstance } from "./identity/instances";
import { outboxChannels } from "./outbox";
import { SeedNotFound } from "./seed";
import { sendAudit } from "./telemetry/audit";

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
const openSessionSchema = z.object({ userId: z.string().min(1) });

const minute = 60 * 1000;

export async function serveControl(request: Request, engine: Engine): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(controlPrefix.length);
  const is = (method: string, pattern: string) =>
    request.method === method && matchPath(pattern, path) !== null;

  try {
    const identityPage = matchPath("/identity/:instanceId", path);
    if (request.method === "GET" && identityPage !== null) {
      const instanceId = identityPage.instanceId;
      if (instanceId === undefined)
        return problem(404, "There is no enabled Identity instance.", {
          code: "identity.no_instance",
        });
      const instance = identityInstance(engine, instanceId);
      if (instance === null)
        return problem(404, "There is no enabled Identity instance.", {
          code: "identity.no_instance",
        });
      const flow = url.searchParams.get("flow") ?? "";
      const accounts = engine.db
        .query<
          { external_id: string; name: string; email: string | null; claims: string },
          [string]
        >(
          "SELECT external_id, name, email, claims FROM fake_identity_accounts WHERE instance_id = ? ORDER BY rowid",
        )
        .all(instance.id);
      const escapeHtml = (value: string) =>
        value.replace(
          /[&<>"']/g,
          (char) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
              char as "&" | "<" | ">" | '"' | "'"
            ] ?? char,
        );
      const rows = accounts
        .map((account) => {
          const href = `/api/login/${encodeURIComponent(instance.id)}/callback?flow=${encodeURIComponent(flow)}&code=${encodeURIComponent(account.external_id)}`;
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(account.name)}</a> — ${escapeHtml(account.email ?? "")} — ${escapeHtml(JSON.parse(account.claims).join(", "))}</li>`;
        })
        .join("");
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(instance.settings.label)}</title></head><body><h1>${escapeHtml(instance.settings.label)}</h1><ul>${rows}</ul></body></html>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (is("POST", "/reset")) {
      const change = resetSchema.safeParse(await bodyOf(request));
      if (!change.success) {
        return invalid(change.error);
      }

      engine.reset(change.data.seed);
      return Response.json({ seed: change.data.seed, now: engine.clock.now().toISOString() });
    }

    if (is("POST", "/sessions")) {
      const input = openSessionSchema.safeParse(await bodyOf(request));
      if (!input.success) {
        return invalid(input.error);
      }
      const user = engine.db
        .query<{ kind: string; suspended_at: string | null }, [string]>(
          "SELECT kind, suspended_at FROM users WHERE id = ?",
        )
        .get(input.data.userId);
      if (user === null) {
        return problem(404, `There is no user named ${input.data.userId}.`, {});
      }
      if (user.kind === "agent") {
        return problem(422, "An agent cannot sign in.", { code: "access.agent_no_login" });
      }
      if (user.suspended_at !== null) {
        return problem(403, "This user is suspended.", { code: "access.suspended" });
      }
      const token = openSession(engine, input.data.userId, null);
      return Response.json(
        { userId: input.data.userId },
        { status: 200, headers: { "Set-Cookie": sessionCookie(token, engine.development) } },
      );
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

    if (is("GET", "/audit")) {
      const records = engine.db
        .query<{ id: number; at: string; record: string }, []>(
          "SELECT id,at,record FROM audit_outbox ORDER BY id",
        )
        .all();
      return Response.json(
        records.map((row) => ({ id: row.id, at: row.at, record: JSON.parse(row.record) })),
      );
    }
    if (is("POST", "/audit/send")) {
      const endpoint = process.env.VERA_ENGINE_OTEL_ENDPOINT;
      if (!endpoint) return problem(409, "There is no audit collector endpoint configured.");
      return Response.json(
        await sendAudit(engine, { endpoint, key: process.env.VERA_ENGINE_OTEL_KEY }),
      );
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

  return problem(404, `No control endpoint answers ${request.method} ${path}.`, {});
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
