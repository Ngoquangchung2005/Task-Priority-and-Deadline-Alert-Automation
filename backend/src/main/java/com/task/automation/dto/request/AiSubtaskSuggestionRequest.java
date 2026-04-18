package com.task.automation.dto.request;

import com.task.automation.enums.TaskPriority;
import lombok.Data;

@Data
public class AiSubtaskSuggestionRequest {
    private String taskName;
    private String taskDescription;
    private TaskPriority priority;
    private String deadline;
    private String adminNote;
}
