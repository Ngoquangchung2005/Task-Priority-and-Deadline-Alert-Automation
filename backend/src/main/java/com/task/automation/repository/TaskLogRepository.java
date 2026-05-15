package com.task.automation.repository;

import com.task.automation.entity.TaskLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface TaskLogRepository extends JpaRepository<TaskLog, Long> {
    List<TaskLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);
    List<TaskLog> findAllByOrderByCreatedAtDesc();
    List<TaskLog> findByTaskIdInOrderByCreatedAtDesc(Collection<Long> taskIds);
    void deleteByTaskId(Long taskId);
}
