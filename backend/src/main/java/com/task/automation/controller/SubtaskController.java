package com.task.automation.controller;

import com.task.automation.dto.request.SubtaskRequest;
import com.task.automation.dto.response.SubtaskResponse;
import com.task.automation.entity.Subtask;
import com.task.automation.enums.TaskStatus;
import com.task.automation.security.UserDetailsImpl;
import com.task.automation.service.SubtaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    public ResponseEntity<List<SubtaskResponse>> getSubtasks(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(toResponses(subtaskService.getSubtasksForManager(taskId, userDetails.getEmail())));
    }

    @GetMapping("/subtasks/task/{taskId}")
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<List<SubtaskResponse>> getSubtasksByTask(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = currentUser();
        List<Subtask> subtasks = isManager(userDetails)
                ? subtaskService.getSubtasksForManager(taskId, userDetails.getEmail())
                : subtaskService.getVisibleSubtasksForUser(taskId, userDetails.getEmail());
        return ResponseEntity.ok(toResponses(subtasks));
    }

    @PostMapping("/tasks/{taskId}/subtasks")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<SubtaskResponse> createSubtask(@PathVariable("taskId") Long taskId, @Valid @RequestBody SubtaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.createSubtask(taskId, request, userDetails.getEmail())));
    }

    @PutMapping("/subtasks/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<SubtaskResponse> updateSubtask(@PathVariable("id") Long id, @Valid @RequestBody SubtaskRequest request) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.updateSubtask(id, request, userDetails.getEmail())));
    }

    @RequestMapping(value = "/subtasks/{id}/status", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<SubtaskResponse> updateStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        TaskStatus status = parseStatus(body);
        UserDetailsImpl userDetails = currentUser();
        Subtask updated = isManager(userDetails)
                ? subtaskService.updateSubtaskStatus(id, status, userDetails.getEmail())
                : subtaskService.updateSubtaskStatusForUser(id, status, userDetails.getEmail());
        return ResponseEntity.ok(SubtaskResponse.from(updated));
    }

    @PatchMapping("/subtasks/{id}/position")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<SubtaskResponse> updatePosition(@PathVariable("id") Long id, @RequestBody Map<String, Integer> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.updateSubtaskPosition(id, body.get("position"), userDetails.getEmail())));
    }

    @DeleteMapping("/subtasks/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<?> deleteSubtask(@PathVariable("id") Long id) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        subtaskService.deleteSubtask(id, userDetails.getEmail());
        return ResponseEntity.ok().build();
    }

    // === User endpoints ===

    @GetMapping("/subtasks/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<SubtaskResponse>> getMyAssignedSubtasks() {
        UserDetailsImpl userDetails = currentUser();
        return ResponseEntity.ok(toResponses(subtaskService.getMySubtasks(userDetails.getEmail())));
    }

    @GetMapping("/users/{email}/subtasks")
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<List<SubtaskResponse>> getSubtasksByEmail(@PathVariable("email") String email) {
        UserDetailsImpl userDetails = currentUser();
        if (!isManager(userDetails) && !userDetails.getEmail().equalsIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot view subtasks for another user");
        }
        return ResponseEntity.ok(toResponses(subtaskService.getSubtasksByAssigneeEmail(email)));
    }

    @GetMapping("/tasks/my-tasks/{taskId}/subtasks")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<SubtaskResponse>> getMySubtasks(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(toResponses(subtaskService.getVisibleSubtasksForUser(taskId, userDetails.getEmail())));
    }

    @PatchMapping("/tasks/my-tasks/subtasks/{id}/status")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<SubtaskResponse> updateMyStatus(@PathVariable("id") Long id, @RequestBody Map<String, String> body) {
        TaskStatus status = parseStatus(body);
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.updateSubtaskStatusForUser(id, status, userDetails.getEmail())));
    }

    @PatchMapping("/tasks/my-tasks/subtasks/{id}/position")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<SubtaskResponse> updateMyPosition(@PathVariable("id") Long id, @RequestBody Map<String, Integer> body) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.updateSubtaskPositionForUser(id, body.get("position"), userDetails.getEmail())));
    }

    private UserDetailsImpl currentUser() {
        return (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private boolean isManager(UserDetailsImpl userDetails) {
        return userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_MANAGER"::equals);
    }

    private List<SubtaskResponse> toResponses(List<Subtask> subtasks) {
        return subtasks.stream().map(SubtaskResponse::from).toList();
    }

    private TaskStatus parseStatus(Map<String, String> body) {
        String status = body == null ? null : body.get("status");
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        }
        try {
            return TaskStatus.valueOf(status);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }
}
