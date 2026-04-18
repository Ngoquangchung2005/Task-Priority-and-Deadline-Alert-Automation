package com.task.automation.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class WebhookSubtaskGenerationRequest {
    private String taskId;
    private List<String> subtaskTitles;
}
