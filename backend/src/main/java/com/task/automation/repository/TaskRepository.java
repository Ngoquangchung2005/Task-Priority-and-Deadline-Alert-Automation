package com.task.automation.repository;

import com.task.automation.entity.Task;
import com.task.automation.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    Optional<Task> findByTaskId(String taskId);
    List<Task> findByAssigneeEmail(String email);
    List<Task> findByManagerEmail(String email);
    
    @Query("SELECT t FROM Task t WHERE t.status IN :statuses AND t.deadline <= CURRENT_TIMESTAMP")
    List<Task> findOverdueTasks(@Param("statuses") List<TaskStatus> statuses);

    @Query("SELECT t FROM Task t WHERE t.status IN :statuses")
    List<Task> findTasksByStatuses(@Param("statuses") List<TaskStatus> statuses);
}
