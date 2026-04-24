package com.task.automation;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import java.security.Key;
import java.util.Date;

public class JwtTest {
    public static void main(String[] args) {
        String jwtSecret = "TaskAutomationSuperSecretKeyForJwtSigning1234567890!@#$";
        Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        String token = Jwts.builder()
                .setSubject("manager@gmail.com")
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + 86400000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        
        System.out.println("Token: " + token);
        
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            System.out.println("Valid parseClaimsJws!");
            Jwts.parserBuilder().setSigningKey(key).build().parse(token);
            System.out.println("Valid parse!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
