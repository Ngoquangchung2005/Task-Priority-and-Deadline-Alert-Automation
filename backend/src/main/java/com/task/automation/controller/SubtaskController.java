package com.task.automation.controller;

import com.task.automation.dto.request.SubtaskRequest;
import com.task.automation.entity.Subtask;
import com.task.automation.enums.TaskStatus;
import com.task.automation.security.UserDetailsImpl;
import com.task.automation.service.SubtaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SubtaskController {

    private final SubtaskService subtaskService;

    // === Manager endpoints ===

    @GetMapping("/tasks/{taskId}/subtasks")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<Subtask>> getSubtasks(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.getSubtasksForManager(taskId, userDetails.getEmail()));
    }

    @PostMapping("/tasks/{taskId}/subtasks")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Subtask> createSubtask(@PathVariable("taskId") Long taskId, @Valid @RequestBody SubtaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.createSubtask(taskId, request, userDetails.getEmail()));
    }

    @PutMapping("/subtasks/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Subtask> updateSubtask(@PathVariable("id") Long id, @Valid @RequestBody SubtaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.updateSubtask(id, request, userDetails.getEmail()));
    }

    @PatchMapping("/subtasks/{id}/status")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Subtask> updateStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        TaskStatus status = TaskStatus.valueOf(body.get("status"));
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.updateSubtaskStatus(id, status, userDetails.getEmail()));
    }

    @PatchMapping("/subtasks/{id}/position")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Subtask> updatePosition(@PathVariable("id") Long id, @RequestBody Map<String, Integer> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.updateSubtaskPosition(id, body.get("position"), userDetails.getEmail()));
    }

    @DeleteMapping("/subtasks/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<?> deleteSubtask(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        subtaskService.deleteSubtask(id, userDetails.getEmail());
        return ResponseEntity.ok().build();
    }

    // === User endpoints ===

    @GetMapping("/tasks/my-tasks/{taskId}/subtasks")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<Subtask>> getMySubtasks(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.getSubtasksForUser(taskId, userDetails.getEmail()));
    }

    @PatchMapping("/tasks/my-tasks/subtasks/{id}/status")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Subtask> updateMyStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        TaskStatus status = TaskStatus.valueOf(body.get("status"));
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.updateSubtaskStatusForUser(id, status, userDetails.getEmail()));
    }

    @PatchMapping("/tasks/my-tasks/subtasks/{id}/position")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Subtask> updateMyPosition(@PathVariable("id") Long id, @RequestBody Map<String, Integer> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(subtaskService.updateSubtaskPositionForUser(id, body.get("position"), userDetails.getEmail()));
    }
}
