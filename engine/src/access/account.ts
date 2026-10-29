// Account and settings follow the signed-in person across devices.
import { endpoints } from "@vera/contract/endpoints";
import { settingsAfter, userSettingsSchema } from "@vera/contract/user-settings";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { accessUser, requireCaller } from "./index";

const defaults = { lastOpenedWatchlists: {} };

export const accountEndpoints = [
  implement(endpoints.account, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const user = accessUser(engine, auth.session.user.id);
    return user === null ? problem(401, "Nobody is signed in.") : { body: user };
  }),
  implement(endpoints.settingsGet, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const raw = engine.db
      .query<{ settings: string }, [string]>("SELECT settings FROM user_settings WHERE user_id=?")
      .get(auth.session.user.id);
    return { body: raw ? userSettingsSchema.parse(JSON.parse(raw.settings)) : defaults };
  }),
  implement(endpoints.settingsPatch, ({ engine, caller, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const current = engine.db
      .query<{ settings: string }, [string]>("SELECT settings FROM user_settings WHERE user_id=?")
      .get(auth.session.user.id);
    const updated = settingsAfter(
      current ? userSettingsSchema.parse(JSON.parse(current.settings)) : defaults,
      body,
    );
    engine.db
      .query(
        "INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings",
      )
      .run(auth.session.user.id, JSON.stringify(updated));
    return { body: updated };
  }),
];
