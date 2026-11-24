package timefolio;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/auth")
class AuthApi {
    record Credentials(@NotBlank @Email @Size(max=254) String email,
                       @NotBlank @Size(min=8, max=72) String password) {}
    record Member(long id, String email) implements java.io.Serializable {}

    private final EntityManager db;
    private final PasswordEncoder encoder;
    private final HttpSessionSecurityContextRepository contexts;
    private final String dummyHash;

    AuthApi(EntityManager db, PasswordEncoder encoder, HttpSessionSecurityContextRepository contexts) {
        this.db = db;
        this.encoder = encoder;
        this.contexts = contexts;
        dummyHash = encoder.encode("TimefolioDummyPassword");
    }

    @GetMapping("/csrf")
    Map<String,String> csrf(CsrfToken token) {
        return Map.of("header", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) @Transactional
    void register(@Valid @RequestBody Credentials input) {
        validatePassword(input.password());
        Account account = new Account();
        account.email = normalize(input.email());
        account.passwordHash = encoder.encode(input.password());
        db.persist(account);
        List<String> names = List.of("수면","업무","학업","이동","식사","운동","취미","게임","영상 시청","자기계발","인간관계","휴식","기타");
        List<String> colors = List.of("#6366f1","#0284c7","#0f766e","#64748b","#c2410c","#15803d","#a21caf");
        List<String> icons = List.of("moon","briefcase","book","train","food","sport","star","game","video","book","people","moon","circle");
        for (int i = 0; i < names.size(); i++) {
            Category category = new Category();
            category.userId = account.id;
            category.name = names.get(i);
            category.color = colors.get(i % colors.size());
            category.icon = icons.get(i);
            db.persist(category);
        }
    }

    @PostMapping("/login") @Transactional(readOnly=true)
    Map<String,String> login(@Valid @RequestBody Credentials input, HttpServletRequest request,
                             HttpServletResponse response) {
        validatePassword(input.password());
        Account account = db.createQuery("from Account where email = :email", Account.class)
            .setParameter("email", normalize(input.email())).getResultStream().findFirst().orElse(null);
        boolean matches = encoder.matches(input.password(), account == null ? dummyHash : account.passwordHash);
        if (!matches || account == null) throw new ApiError(401, "이메일 또는 비밀번호를 확인해 주세요.");
        request.getSession();
        request.changeSessionId();
        new HttpSessionCsrfTokenRepository().saveToken(null, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
            new Member(account.id, account.email), null, List.of()));
        contexts.saveContext(context, request, response);
        return Map.of("email", account.email);
    }

    @GetMapping("/me")
    Map<String,String> me(Authentication authentication) {
        return Map.of("email", member(authentication).email());
    }

    static Member member(Authentication auth) {
        return (Member) auth.getPrincipal();
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static void validatePassword(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf(0) >= 0)
            throw new ApiError(400, "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.");
    }
}
