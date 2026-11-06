package cz.mzk.vera.projects;

import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;

import cz.mzk.vera.web.Instants;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// PROJECT-create; PROJECT-review: serve projectSchema records for document group headers.
@Repository
public class ProjectQueries {
    private final DSLContext dsl;

    public ProjectQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Map<String, Map<String, Object>> projectsOf(List<String> ids) {
        Map<String, Map<String, Object>> projects = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return projects;
        }
        Map<String, List<String>> members = new LinkedHashMap<>();
        dsl.select(PROJECT_MEMBERS.PROJECT_ID, PROJECT_MEMBERS.USER_ID).from(PROJECT_MEMBERS)
            .where(PROJECT_MEMBERS.PROJECT_ID.in(ids))
            .orderBy(PROJECT_MEMBERS.PROJECT_ID, PROJECT_MEMBERS.POSITION).fetch().forEach(row ->
                members.computeIfAbsent(row.get(PROJECT_MEMBERS.PROJECT_ID), ignored -> new ArrayList<>())
                    .add(row.get(PROJECT_MEMBERS.USER_ID)));
        Map<String, List<String>> groups = new LinkedHashMap<>();
        dsl.select(PROJECT_MEMBER_GROUPS.PROJECT_ID, PROJECT_MEMBER_GROUPS.GROUP_ID)
            .from(PROJECT_MEMBER_GROUPS).where(PROJECT_MEMBER_GROUPS.PROJECT_ID.in(ids))
            .orderBy(PROJECT_MEMBER_GROUPS.PROJECT_ID, PROJECT_MEMBER_GROUPS.POSITION).fetch().forEach(row ->
                groups.computeIfAbsent(row.get(PROJECT_MEMBER_GROUPS.PROJECT_ID), ignored -> new ArrayList<>())
                    .add(row.get(PROJECT_MEMBER_GROUPS.GROUP_ID)));
        dsl.selectFrom(PROJECTS).where(PROJECTS.ID.in(ids)).fetch().forEach(row -> {
            Map<String, Object> project = new LinkedHashMap<>();
            project.put("id", row.getId());
            project.put("name", row.getName());
            project.put("description", row.getDescription());
            project.put("startsOn", row.getStartsOn().toString());
            project.put("endsOn", row.getEndsOn().toString());
            project.put("managerId", row.getManagerId());
            project.put("memberIds", members.getOrDefault(row.getId(), List.of()));
            project.put("memberGroupIds", groups.getOrDefault(row.getId(), List.of()));
            project.put("createdAt", Instants.format(row.getCreatedAt().toInstant()));
            project.put("state", row.getState());
            if ("Approved".equals(row.getState())) {
                project.put("priority", row.getPriority());
                project.put("actorId", row.getActedBy());
                project.put("at", Instants.format(row.getActedAt().toInstant()));
            } else if ("Rejected".equals(row.getState())) {
                project.put("reason", row.getReason());
                project.put("actorId", row.getActedBy());
                project.put("at", Instants.format(row.getActedAt().toInstant()));
            }
            projects.put(row.getId(), project);
        });
        return projects;
    }

    public List<String> idsByName() {
        List<Map.Entry<String, String>> names = new ArrayList<>();
        dsl.select(PROJECTS.ID, PROJECTS.NAME).from(PROJECTS).fetch()
            .forEach(row -> names.add(Map.entry(row.get(PROJECTS.ID), row.get(PROJECTS.NAME))));
        names.sort((first, second) -> java.text.Collator.getInstance(java.util.Locale.US)
            .compare(first.getValue(), second.getValue()));
        return names.stream().map(Map.Entry::getKey).toList();
    }
}
