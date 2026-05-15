package com.task.automation.controller;

import com.task.automation.dto.response.TaskLogResponse;
import com.task.automation.entity.Subtask;
import com.task.automation.entity.Task;
import com.task.automation.entity.TaskLog;
import com.task.automation.repository.SubtaskRepository;
import com.task.automation.repository.TaskLogRepository;
import com.task.automation.repository.TaskRepository;
import com.task.automation.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TaskLogController {

    private final TaskRepository taskRepository;
    private final SubtaskRepository subtaskRepository;
    private final TaskLogRepository taskLogRepository;

    @GetMapping("/tasks/{taskId}/logs")
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<List<TaskLogResponse>> getTaskLogs(@PathVariable("taskId") Long taskId) {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        boolean isManager = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_MANAGER"::equals);

        if (isManager) {
            taskRepository.findByIdAndManagerEmail(taskId, userDetails.getEmail())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        } else {
            boolean ownsParent = taskRepository.findByIdAndAssigneeEmail(taskId, userDetails.getEmail()).isPresent();
            boolean ownsSubtask = !subtaskRepository
                    .findByTaskIdAndAssignedToIgnoreCaseOrderByPositionIndexAsc(taskId, userDetails.getEmail())
                    .isEmpty();
            if (!ownsParent && !ownsSubtask) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
            }
        }

        Task task = taskRepository.findById(taskId).orElse(null);
        return ResponseEntity.ok(taskLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId)
                .stream()
                .map(log -> TaskLogResponse.from(log, task))
                .toList());
    }

    @GetMapping("/notifications")
    @PreAuthorize("hasAnyRole('MANAGER','USER')")
    public ResponseEntity<List<TaskLogResponse>> getNotifications() {
        UserDetailsImpl userDetails = (UserDetailsImpl) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        boolean isManager = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_MANAGER"::equals);

        List<TaskLog> logs;
        if (isManager) {
            Set<Long> taskIds = taskRepository.findByManagerEmail(userDetails.getEmail())
                    .stream()
                    .map(Task::getId)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            if (taskIds.isEmpty()) {
                return ResponseEntity.ok(List.of());
            }
            logs = taskLogRepository.findByTaskIdInOrderByCreatedAtDesc(taskIds);
        } else {
            Set<Long> taskIds = new LinkedHashSet<>();
            taskRepository.findByAssigneeEmail(userDetails.getEmail())
                    .forEach(task -> taskIds.add(task.getId()));
            subtaskRepository.findByAssignedToIgnoreCaseOrderByDeadlineAscPositionIndexAsc(userDetails.getEmail())
                    .stream()
                    .map(Subtask::getTask)
                    .filter(task -> task != null)
                    .forEach(task -> taskIds.add(task.getId()));

            if (taskIds.isEmpty()) {
                return ResponseEntity.ok(List.of());
            }
            logs = taskLogRepository.findByTaskIdInOrderByCreatedAtDesc(taskIds);
        }

        return ResponseEntity.ok(toResponses(logs));
    }

    private List<TaskLogResponse> toResponses(List<TaskLog> logs) {
        Set<Long> taskIds = logs.stream()
                .map(TaskLog::getTaskId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Task> tasksById = findTasks(taskIds).stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));

        return logs.stream()
                .map(log -> TaskLogResponse.from(log, tasksById.get(log.getTaskId())))
                .toList();
    }

    private List<Task> findTasks(Collection<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return List.of();
        }
        return taskRepository.findAllById(taskIds);
    }
}
