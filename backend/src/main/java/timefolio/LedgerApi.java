package timefolio;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
class LedgerApi {
    record CopyDate(@NotNull LocalDate date) {}
    private final Ledger ledger;

    LedgerApi(Ledger ledger) {
        this.ledger = ledger;
    }

    @GetMapping("/categories")
    List<Ledger.CategoryView> categories(Authentication auth) {
        return ledger.categories(user(auth));
    }

    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    Ledger.CategoryView addCategory(Authentication auth, @Valid @RequestBody Ledger.CategoryInput input) {
        return ledger.saveCategory(user(auth), null, input);
    }

    @PutMapping("/categories/{id}")
    Ledger.CategoryView editCategory(Authentication auth, @PathVariable long id,
                                      @Valid @RequestBody Ledger.CategoryInput input) {
        return ledger.saveCategory(user(auth), id, input);
    }

    @DeleteMapping("/categories/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCategory(Authentication auth, @PathVariable long id) {
        ledger.deleteCategory(user(auth), id);
    }

    @GetMapping("/entries")
    Ledger.Day day(Authentication auth, @RequestParam LocalDate date) {
        return ledger.day(user(auth), date);
    }

    @GetMapping("/entries/recent")
    List<Ledger.Recent> recent(Authentication auth) {
        return ledger.recent(user(auth));
    }

    @PostMapping("/entries") @ResponseStatus(HttpStatus.CREATED)
    Ledger.View add(Authentication auth, @Valid @RequestBody Ledger.Input input) {
        return ledger.saveEntry(user(auth), null, input);
    }

    @PutMapping("/entries/{id}")
    Ledger.View edit(Authentication auth, @PathVariable long id, @Valid @RequestBody Ledger.Input input) {
        return ledger.saveEntry(user(auth), id, input);
    }

    @DeleteMapping("/entries/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(Authentication auth, @PathVariable long id) {
        ledger.deleteEntry(user(auth), id);
    }

    @PostMapping("/entries/copy")
    Map<String,Integer> copy(Authentication auth, @Valid @RequestBody CopyDate input) {
        return Map.of("created", ledger.copy(user(auth), input.date()));
    }

    private long user(Authentication auth) {
        return AuthApi.member(auth).id();
    }
}
