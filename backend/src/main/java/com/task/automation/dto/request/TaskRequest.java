package com.task.automation.dto.request;

import com.task.automation.enums.TaskPriority;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskRequest {
    @NotBlank
    private String taskName;

    private String taskDescription;

    @NotBlank
    @Email
    private String assigneeEmail;

    @NotNull
    private TaskPriority priority;

    private LocalDateTime deadline;

    private String adminNote;

    private String sourceInput;

    @Valid
    private List<SubtaskRequest> subtasks;

    private List<String> subtaskTitles;
}
