package com.task.automation.dto.response;

import com.task.automation.entity.Task;
import com.task.automation.entity.TaskLog;
import com.task.automation.enums.ActionType;
import com.task.automation.enums.TaskPriority;
import com.task.automation.enums.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TaskLogResponse {
    private Long id;
    private Long taskDbId;
    private String taskCode;
    private String taskName;
    private String assigneeEmail;
    private String managerEmail;
    private TaskPriority priority;
    private TaskStatus status;
    private LocalDateTime deadline;
    private ActionType actionType;
    private String actionMessage;
    private LocalDateTime createdAt;

    public static TaskLogResponse from(TaskLog log, Task task) {
        return TaskLogResponse.builder()
                .id(log.getId())
                .taskDbId(log.getTaskId())
                .taskCode(task != null ? task.getTaskId() : null)
                .taskName(task != null ? task.getTaskName() : null)
                .assigneeEmail(task != null ? task.getAssigneeEmail() : null)
                .managerEmail(task != null ? task.getManagerEmail() : null)
                .priority(task != null ? task.getPriority() : null)
                .status(task != null ? task.getStatus() : null)
                .deadline(task != null ? task.getDeadline() : null)
                .actionType(log.getActionType())
                .actionMessage(log.getActionMessage())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
