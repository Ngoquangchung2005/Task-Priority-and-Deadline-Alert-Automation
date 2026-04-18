package com.task.automation.controller;

import com.task.automation.dto.request.WebhookSyncRequest;
import com.task.automation.dto.request.WebhookSubtaskGenerationRequest;
import com.task.automation.dto.response.MessageResponse;
import com.task.automation.service.SubtaskService;
import com.task.automation.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class WebhookController {

    private final TaskService taskService;
    private final SubtaskService subtaskService;

    @Value("${app.webhookSecret:local-n8n-sync-secret}")
    private String webhookSecret;

    @PostMapping("/sync")
    public ResponseEntity<?> handleSync(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret,
            @RequestBody WebhookSyncRequest request) {
        validateWebhookSecret(providedSecret);
        taskService.handleWebhookSync(request);
        return ResponseEntity.ok(new MessageResponse("Sync successful"));
    }

    @GetMapping("/pending-reminders")
    public ResponseEntity<?> getPendingReminders(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret) {
        validateWebhookSecret(providedSecret);
        return ResponseEntity.ok(taskService.getPendingReminders());
    }
    
    @GetMapping("/overdue-escalations")
    public ResponseEntity<?> getOverdueEscalations(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret) {
        validateWebhookSecret(providedSecret);
        return ResponseEntity.ok(taskService.getOverdueTasks());
    }

    @PostMapping("/subtasks/generate")
    public ResponseEntity<?> generateSubtasks(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret,
            @RequestBody WebhookSubtaskGenerationRequest request) {
        validateWebhookSecret(providedSecret);
        if (request == null || request.getTaskId() == null || request.getTaskId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "taskId is required");
        }
        int createdCount = subtaskService.createSubtasksFromWebhook(request.getTaskId(), request.getSubtaskTitles());
        return ResponseEntity.ok(new MessageResponse("Generated " + createdCount + " subtasks"));
    }

    private void validateWebhookSecret(String providedSecret) {
        if (!Objects.equals(webhookSecret, providedSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid webhook secret");
        }
    }
}
