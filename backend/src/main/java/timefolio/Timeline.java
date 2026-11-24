package timefolio;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

record Span(LocalDateTime start, LocalDateTime end) {}

final class Timeline {
    private Timeline() {}

    static long union(List<Span> spans, LocalDateTime from, LocalDateTime to) {
        LocalDateTime cursor = from;
        long minutes = 0;
        for (Span span : spans.stream().sorted(Comparator.comparing(Span::start)).toList()) {
            if (!span.start().isBefore(to)) break;
            LocalDateTime start = span.start().isAfter(cursor) ? span.start() : cursor;
            LocalDateTime end = span.end().isBefore(to) ? span.end() : to;
            if (end.isAfter(start)) {
                minutes += Duration.between(start, end).toMinutes();
                cursor = end;
            }
        }
        return minutes;
    }
}
