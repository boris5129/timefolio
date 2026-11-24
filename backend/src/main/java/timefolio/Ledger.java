package timefolio;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional
class Ledger {
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    static final Set<String> ICONS = Set.of("moon","briefcase","book","train","food","sport","star","game","video","people","circle");
    record CategoryInput(@NotBlank @Size(max=40) String name,
                         @NotBlank @Pattern(regexp="#[0-9A-Fa-f]{6}") String color,
                         @NotBlank String icon) {}
    record CategoryView(long id, String name, String color, String icon) {}
    record Input(@NotBlank @Size(max=100) String title, @NotNull @Positive Long categoryId,
                 @NotNull LocalDateTime start, @NotNull LocalDateTime end,
                 @NotBlank @Pattern(regexp="ACTUAL|PLANNED") String kind,
                 @Size(max=500) String memo) {}
    record View(long id, long categoryId, String title, LocalDateTime start, LocalDateTime end,
                String kind, String memo) {}
    record Recent(String title, long categoryId) {}
    record Day(LocalDate date, LocalDate today, long actual, long planned, long unrecorded, long available,
               long primary, long secondary, long total, List<View> entries) {}

    private final EntityManager db;

    Ledger(EntityManager db) {
        this.db = db;
    }

    @Transactional(readOnly=true)
    List<CategoryView> categories(long user) {
        return db.createQuery("from Category where userId=:user order by id", Category.class)
            .setParameter("user", user).getResultList().stream().map(this::view).toList();
    }

    CategoryView saveCategory(long user, Long id, CategoryInput input) {
        lock(user);
        if (!ICONS.contains(input.icon())) throw new ApiError(400, "카테고리 아이콘을 선택해 주세요.");
        Category category = id == null ? new Category() : category(user, id);
        category.userId = user;
        category.name = input.name().strip();
        category.color = input.color().toLowerCase(Locale.ROOT);
        category.icon = input.icon();
        if (id == null) db.persist(category);
        db.flush();
        return view(category);
    }

    void deleteCategory(long user, long id) {
        lock(user);
        db.remove(category(user, id));
        db.flush();
    }

    @Transactional(readOnly=true)
    Day day(long user, LocalDate date) {
        validateDate(date);
        var from = utc(date.atStartOfDay());
        var to = utc(date.plusDays(1).atStartOfDay());
        var entries = db.createQuery("""
            from Entry where userId=:user and startedAt<:end and endedAt>:start order by startedAt,id
            """, Entry.class).setParameter("user", user).setParameter("start", from)
            .setParameter("end", to).getResultList();
        long actual = Timeline.union(spans(entries, "ACTUAL"), from, to);
        long planned = Timeline.union(spans(entries, "PLANNED"), from, to);
        long total = Duration.between(from, to).toMinutes();
        long occupied = Timeline.union(spans(entries, null), from, to);
        return new Day(date, LocalDate.now(ZONE), actual, planned, total-actual, total-occupied, actual, 0,
            total, entries.stream().map(this::view).toList());
    }

    @Transactional(readOnly=true)
    List<Recent> recent(long user) {
        return db.createQuery("""
            select new timefolio.Ledger$Recent(title, categoryId)
            from Entry where userId=:user group by title,categoryId
            order by max(id) desc
            """, Recent.class).setParameter("user", user).setMaxResults(6).getResultList();
    }

    View saveEntry(long user, Long id, Input input) {
        lock(user);
        category(user, input.categoryId());
        Entry entry = id == null ? new Entry() : entry(user, id);
        fill(user, entry, input);
        if (id == null) db.persist(entry);
        db.flush();
        return view(entry);
    }

    void deleteEntry(long user, long id) {
        lock(user);
        db.remove(entry(user, id));
    }

    int copy(long user, LocalDate date) {
        lock(user);
        validateDate(date);
        var previous = date.minusDays(1);
        var existing = new java.util.HashSet<>(day(user, date).entries().stream()
            .filter(row -> row.kind().equals("PLANNED")).map(this::identity).toList());
        int created = 0;
        for (View source : day(user, previous).entries()) {
            if (!source.start().toLocalDate().equals(previous)) continue;
            var input = new Input(source.title(), source.categoryId(), source.start().plusDays(1),
                source.end().plusDays(1), "PLANNED", source.memo());
            Entry entry = new Entry();
            fill(user, entry, input);
            if (existing.add(identity(view(entry)))) {
                db.persist(entry);
                created++;
            }
        }
        return created;
    }

    private List<Span> spans(List<Entry> entries, String kind) {
        return entries.stream().filter(e -> kind == null || kind.equals(e.kind))
            .map(e -> new Span(e.startedAt, e.endedAt)).toList();
    }

    private record Identity(long category, String title, LocalDateTime start, LocalDateTime end) {}

    private Identity identity(View view) {
        return new Identity(view.categoryId(), view.title(), view.start(), view.end());
    }

    private void lock(long user) {
        db.find(Account.class, user, LockModeType.PESSIMISTIC_WRITE);
    }

    private Category category(long user, long id) {
        return db.createQuery("from Category where id=:id and userId=:user", Category.class)
            .setParameter("id", id).setParameter("user", user).getResultStream().findFirst()
            .orElseThrow(() -> new ApiError(404, "카테고리를 찾을 수 없습니다."));
    }

    private Entry entry(long user, long id) {
        return db.createQuery("from Entry where id=:id and userId=:user", Entry.class)
            .setParameter("id", id).setParameter("user", user).getResultStream().findFirst()
            .orElseThrow(() -> new ApiError(404, "활동을 찾을 수 없습니다."));
    }

    private void fill(long user, Entry entry, Input input) {
        validateDate(input.start().toLocalDate());
        validateDate(input.end().toLocalDate());
        if (!input.end().isAfter(input.start()))
            throw new ApiError(400, "종료 시각은 시작 시각보다 늦어야 합니다.");
        if (input.start().getSecond() != 0 || input.end().getSecond() != 0 ||
            input.start().getNano() != 0 || input.end().getNano() != 0)
            throw new ApiError(400, "활동 시각은 분 단위로 입력해 주세요.");
        entry.userId = user;
        entry.categoryId = input.categoryId();
        entry.title = input.title().strip();
        entry.startedAt = utc(input.start());
        entry.endedAt = utc(input.end());
        entry.kind = input.kind();
        entry.memo = input.memo() == null ? "" : input.memo().strip();
    }

    private void validateDate(LocalDate date) {
        if (date == null || date.getYear() < 1901 || date.getYear() > 9998)
            throw new ApiError(400, "날짜는 1901년부터 9998년 사이로 입력해 주세요.");
    }

    private LocalDateTime utc(LocalDateTime local) {
        return local.atZone(ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private LocalDateTime local(LocalDateTime utc) {
        return utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(ZONE).toLocalDateTime();
    }

    private CategoryView view(Category c) {
        return new CategoryView(c.id, c.name, c.color, c.icon);
    }

    private View view(Entry e) {
        return new View(e.id == null ? 0 : e.id, e.categoryId, e.title, local(e.startedAt), local(e.endedAt), e.kind, e.memo);
    }
}
