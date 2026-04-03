package com.task.automation.dto.response;

import com.task.automation.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private Long id;
    private String fullName;
    private String email;
    private Role role;
    private Boolean mustChangePassword;
}
