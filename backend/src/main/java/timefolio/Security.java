package timefolio;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

@Configuration
class Security {
    @Bean PasswordEncoder passwords() {
        return new BCryptPasswordEncoder();
    }

    @Bean HttpSessionSecurityContextRepository contexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean SecurityFilterChain security(HttpSecurity http, HttpSessionSecurityContextRepository contexts,
                                       ObjectMapper json) throws Exception {
        http.securityContext(c -> c.securityContextRepository(contexts))
            .requestCache(c -> c.disable())
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/csrf", "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> error(json, res, 401, "로그인이 필요합니다."))
                .accessDeniedHandler((req, res, ex) -> error(json, res, 403, "요청을 확인할 수 없습니다. 화면을 새로고침해 주세요.")))
            .logout(l -> l.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)));
        return http.build();
    }

    private void error(ObjectMapper json, HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        json.writeValue(response.getOutputStream(), Map.of("message", message));
    }
}
