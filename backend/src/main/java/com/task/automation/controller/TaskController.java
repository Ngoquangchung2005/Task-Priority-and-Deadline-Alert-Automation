package com.task.automation.controller;

import com.task.automation.dto.request.TaskRequest;
import com.task.automation.entity.Task;
import com.task.automation.enums.TaskStatus;
import com.task.automation.security.UserDetailsImpl;
import com.task.automation.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    
    private final TaskService taskService;

    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Task> createTask(@Valid @RequestBody TaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Task created = taskService.createTask(request, userDetails.getEmail(), userDetails.getFullName());
        return ResponseEntity.ok(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        boolean isManager = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_MANAGER"::equals);

        return taskService.getTaskForActor(id, userDetails.getEmail(), isManager)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<Task>> getManagerTasks() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(taskService.getAllTasksForManager(userDetails.getEmail()));
    }

    @GetMapping("/my-tasks")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<Task>> getUserTasks() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(taskService.getTasksForUser(userDetails.getEmail()));
    }

    @GetMapping("/my-tasks/{id}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Task> getUserTaskById(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return taskService.getTaskForUser(id, userDetails.getEmail())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<Task> updateTaskStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        TaskStatus status = TaskStatus.valueOf(body.get("status"));
        boolean isManager = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_MANAGER"::equals);

        Task updated = isManager
                ? taskService.updateTaskStatusForManager(id, status, userDetails.getEmail())
                : taskService.updateTaskStatusForUser(id, status, userDetails.getEmail());
        return ResponseEntity.ok(updated);
    }
    
    @GetMapping("/overdue")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<Task>> getOverdueTasks() {
        return ResponseEntity.ok(taskService.getOverdueTasks());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Task> updateTask(@PathVariable("id") Long id, @Valid @RequestBody TaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(taskService.updateTask(id, request, userDetails.getEmail()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Task> cancelTask(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(taskService.cancelTask(id, userDetails.getEmail()));
    }

    @DeleteMapping("/{id}/permanent")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Void> permanentlyDeleteStoredTask(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        taskService.permanentlyDeleteStoredTask(id, userDetails.getEmail());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Task> updateArchiveState(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Boolean> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        boolean archived = body == null || body.getOrDefault("archived", true);
        Task task = archived
                ? taskService.archiveTask(id, userDetails.getEmail())
                : taskService.unarchiveTask(id, userDetails.getEmail());
        return ResponseEntity.ok(task);
    }

    @PostMapping("/generate-subtasks")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> generateSubtasks(@RequestBody Map<String, String> payload) {
        String taskName = payload.get("taskName");
        return ResponseEntity.ok(taskService.generateSubtasksFromN8n(taskName));
    }
}
