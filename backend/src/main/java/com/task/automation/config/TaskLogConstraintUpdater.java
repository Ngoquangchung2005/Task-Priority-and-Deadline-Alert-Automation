package com.task.automation.config;

import com.task.automation.enums.ActionType;
import com.task.automation.enums.TaskStatus;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

@Component
public class TaskLogConstraintUpdater {

    private static final Logger log = LoggerFactory.getLogger(TaskLogConstraintUpdater.class);

    private final JdbcTemplate jdbcTemplate;

    public TaskLogConstraintUpdater(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void syncEnumCheckConstraints() {
        syncTaskLogActionTypeConstraint();
        syncTaskStatusConstraint();
    }

    private void syncTaskLogActionTypeConstraint() {
        String allowedValues = Arrays.stream(ActionType.values())
                .map(ActionType::name)
                .map(value -> "'" + value + "'")
                .collect(Collectors.joining(", "));

        try {
            jdbcTemplate.execute("ALTER TABLE task_logs DROP CONSTRAINT IF EXISTS task_logs_action_type_check");
            jdbcTemplate.execute("""
                    ALTER TABLE task_logs
                    ADD CONSTRAINT task_logs_action_type_check
                    CHECK (action_type IN (%s))
                    """.formatted(allowedValues));
            log.info("Synchronized task_logs_action_type_check with ActionType enum values");
        } catch (Exception exception) {
            log.warn("Failed to synchronize task_logs_action_type_check", exception);
        }
    }

    private void syncTaskStatusConstraint() {
        String allowedValues = Arrays.stream(TaskStatus.values())
                .map(TaskStatus::name)
                .map(value -> "'" + value + "'")
                .collect(Collectors.joining(", "));

        try {
            jdbcTemplate.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check");
            jdbcTemplate.execute("""
                    ALTER TABLE tasks
                    ADD CONSTRAINT tasks_status_check
                    CHECK (status IN (%s))
                    """.formatted(allowedValues));
            log.info("Synchronized tasks_status_check with TaskStatus enum values");
        } catch (Exception exception) {
            log.warn("Failed to synchronize tasks_status_check", exception);
        }
    }
}
