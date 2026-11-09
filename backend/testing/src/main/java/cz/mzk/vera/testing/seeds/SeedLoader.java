package cz.mzk.vera.testing.seeds;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.DELETED_PROPERTY_KEYS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class SeedLoader {
    private final DSLContext dsl;
    private final RecordsSeedLoader records;

    public SeedLoader(DSLContext dsl, RecordsSeedLoader records) {
        this.dsl = dsl;
        this.records = records;
    }

    public void load(JsonNode seed) {
        load(dsl, seed);
    }

    public void load(DSLContext target, JsonNode seed) {
        target.transaction(configuration -> insert(DSL.using(configuration), seed));
    }

    private void insert(DSLContext transaction, JsonNode seed) {
        JsonNode collections = seed.path("collections");
        int position = 0;
        for (JsonNode user : collections.path("users")) {
            JsonNode access = collections.path("userAccess").path(user.path("id").asString());
            transaction.insertInto(USERS)
                    .set(USERS.ID, string(user, "id"))
                    .set(USERS.NAME, string(user, "name"))
                    .set(USERS.KIND, string(user, "kind"))
                    .set(USERS.EMAIL, nullableString(user, "email"))
                    .set(USERS.ENTRY, nullableString(access, "entry"))
                    .set(USERS.SUSPENDED_AT, instant(access, "suspendedAt"))
                    .set(USERS.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode role : collections.path("roles")) {
            String roleId = string(role, "id");
            transaction.insertInto(ROLES)
                    .set(ROLES.ID, roleId)
                    .set(ROLES.NAME, string(role, "name"))
                    .set(ROLES.DESCRIPTION, string(role, "description"))
                    .set(ROLES.IS_SHIPPED, role.path("isShipped").asBoolean())
                    .set(ROLES.PROPOSAL_BATCH_LIMIT, nullableInteger(role, "proposalBatchLimit"))
                    .set(ROLES.PROPOSAL_DAILY_LIMIT, nullableInteger(role, "proposalDailyLimit"))
                    .set(ROLES.POSITION, position++)
                    .execute();

            int grantPosition = 0;
            for (JsonNode grant : role.path("grants")) {
                transaction.insertInto(ROLE_GRANTS)
                        .set(ROLE_GRANTS.ROLE_ID, roleId)
                        .set(ROLE_GRANTS.POSITION, grantPosition++)
                        .set(ROLE_GRANTS.PERMISSION, string(grant, "permission"))
                        .set(ROLE_GRANTS.SCOPE, nullableString(grant, "scope"))
                        .execute();
            }
        }

        collections.path("userAccess").properties().forEach(entry -> {
            String userId = entry.getKey();
            JsonNode access = entry.getValue();
            int rolePosition = 0;
            for (JsonNode roleId : access.path("handRoleIds")) {
                transaction.insertInto(USER_HAND_ROLES)
                        .set(USER_HAND_ROLES.USER_ID, userId)
                        .set(USER_HAND_ROLES.ROLE_ID, roleId.asString())
                        .set(USER_HAND_ROLES.POSITION, rolePosition++)
                        .execute();
            }
            rolePosition = 0;
            for (JsonNode mappedRole : access.path("mappedRoles")) {
                transaction.insertInto(USER_MAPPED_ROLES)
                        .set(USER_MAPPED_ROLES.USER_ID, userId)
                        .set(USER_MAPPED_ROLES.ROLE_ID, string(mappedRole, "roleId"))
                        .set(USER_MAPPED_ROLES.INSTANCE_ID, string(mappedRole, "instanceId"))
                        .set(USER_MAPPED_ROLES.CLAIM, string(mappedRole, "claim"))
                        .set(USER_MAPPED_ROLES.POSITION, rolePosition++)
                        .execute();
            }
            int identityPosition = 0;
            for (JsonNode identity : access.path("identities")) {
                transaction.insertInto(USER_IDENTITIES)
                        .set(USER_IDENTITIES.USER_ID, userId)
                        .set(USER_IDENTITIES.INSTANCE_ID, string(identity, "instanceId"))
                        .set(USER_IDENTITIES.EXTERNAL_ID, string(identity, "externalId"))
                        .set(USER_IDENTITIES.LAST_LOGIN_AT, instant(identity, "lastLoginAt"))
                        .set(USER_IDENTITIES.POSITION, identityPosition++)
                        .execute();
            }
        });

        position = 0;
        for (JsonNode category : collections.path("categories")) {
            transaction.insertInto(CATEGORIES)
                    .set(CATEGORIES.ID, string(category, "id"))
                    .set(CATEGORIES.NAME, string(category, "name"))
                    .set(CATEGORIES.PARENT_ID, nullableString(category, "parentId"))
                    .set(CATEGORIES.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode group : collections.path("groups")) {
            String groupId = string(group, "id");
            transaction.insertInto(GROUPS)
                    .set(GROUPS.ID, groupId)
                    .set(GROUPS.NAME, string(group, "name"))
                    .set(GROUPS.DESCRIPTION, string(group, "description"))
                    .set(GROUPS.POSITION, position++)
                    .execute();
            int memberPosition = 0;
            for (JsonNode memberId : group.path("memberIds")) {
                transaction.insertInto(GROUP_MEMBERS)
                        .set(GROUP_MEMBERS.GROUP_ID, groupId)
                        .set(GROUP_MEMBERS.USER_ID, memberId.asString())
                        .set(GROUP_MEMBERS.POSITION, memberPosition++)
                        .execute();
            }
            int categoryPosition = 0;
            for (JsonNode categoryId : group.path("categoryIds")) {
                transaction.insertInto(GROUP_CATEGORIES)
                        .set(GROUP_CATEGORIES.GROUP_ID, groupId)
                        .set(GROUP_CATEGORIES.CATEGORY_ID, categoryId.asString())
                        .set(GROUP_CATEGORIES.POSITION, categoryPosition++)
                        .execute();
            }
        }

        for (Map.Entry<String, JsonNode> entry : collections.path("categoryMembers").properties()) {
            int memberPosition = 0;
            for (JsonNode userId : entry.getValue()) {
                transaction.insertInto(CATEGORY_MEMBERS)
                        .set(CATEGORY_MEMBERS.CATEGORY_ID, entry.getKey())
                        .set(CATEGORY_MEMBERS.USER_ID, userId.asString())
                        .set(CATEGORY_MEMBERS.POSITION, memberPosition++)
                        .execute();
            }
        }

        position = 0;
        for (JsonNode implementation : collections.path("pluginImplementations")) {
            transaction.insertInto(PLUGIN_IMPLEMENTATIONS)
                    .set(PLUGIN_IMPLEMENTATIONS.ID, string(implementation, "id"))
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID, string(implementation, "descriptorId"))
                    .set(PLUGIN_IMPLEMENTATIONS.NAME, string(implementation, "name"))
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTION, string(implementation, "description"))
                    .set(PLUGIN_IMPLEMENTATIONS.KIND, string(implementation, "kind"))
                    .set(PLUGIN_IMPLEMENTATIONS.VERSIONS, JSONB.valueOf(implementation.path("versions").toString()))
                    .set(PLUGIN_IMPLEMENTATIONS.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode instance : collections.path("pluginInstances")) {
            ObjectNode configuration = (ObjectNode) instance.path("configuration").deepCopy();
            JsonNode catalog = seed.path("fakes").path("catalogBases").path(
                    configuration.path("base_url").asString());
            if (!catalog.isMissingNode()) {
                configuration.put("opac_url", catalog.path("opacUrl").asString());
                configuration.put("catalog_base", catalog.path("base").asString());
            }
            transaction.insertInto(PLUGIN_INSTANCES)
                    .set(PLUGIN_INSTANCES.ID, string(instance, "id"))
                    .set(PLUGIN_INSTANCES.NAME, string(instance, "name"))
                    .set(PLUGIN_INSTANCES.IMPLEMENTATION_ID, string(instance, "implementationId"))
                    .set(PLUGIN_INSTANCES.CONFIGURATION, JSONB.valueOf(configuration.toString()))
                    .set(PLUGIN_INSTANCES.SETTINGS, nullableJson(instance, "settings"))
                    .set(PLUGIN_INSTANCES.TRIGGERS, JSONB.valueOf(instance.path("triggers").toString()))
                    .set(PLUGIN_INSTANCES.IS_ENABLED, instance.path("isEnabled").asBoolean())
                    .set(PLUGIN_INSTANCES.IS_DELETED, instance.path("isDeleted").asBoolean())
                    .set(PLUGIN_INSTANCES.CREATED_AT, instant(instance, "createdAt"))
                    .set(PLUGIN_INSTANCES.LAST_RUN_AT, instant(instance, "lastRunAt"))
                    .set(PLUGIN_INSTANCES.POSITION, position++)
                    .execute();
        }
        transaction.deleteFrom(DELETED_PROPERTY_KEYS).execute();
        for (JsonNode key : collections.path("deletedPropertyKeys")) {
            transaction.insertInto(DELETED_PROPERTY_KEYS)
                    .set(DELETED_PROPERTY_KEYS.KEY, key.asString())
                    .execute();
        }
        records.catalogMirror(transaction, seed);
        records.load(transaction, collections);
    }

    private String string(JsonNode object, String field) {
        return object.path(field).asString();
    }

    private String nullableString(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private Integer nullableInteger(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }

    private OffsetDateTime instant(JsonNode object, String field) {
        String value = nullableString(object, field);
        if (value == null) {
            return null;
        }
        Instant parsed = value.length() == 10
                ? LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.parse(value);
        return parsed.atOffset(ZoneOffset.UTC);
    }

    private JSONB nullableJson(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : JSONB.valueOf(value.toString());
    }
}
