package timefolio;

import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class TimelineTest {
    private final LocalDateTime midnight = LocalDateTime.of(2026, 11, 24, 0, 0);

    @Test void fullAndPartialOverlap() {
        assertThat(Timeline.union(List.of(span(0,60), span(0,60), span(10,50)), midnight, midnight.plusDays(1)))
            .isEqualTo(60);
    }

    @Test void clipsAtMidnightAndIncludesDisjointIntervals() {
        assertThat(Timeline.union(List.of(span(1430,1470), span(-30,30), span(60,90)), midnight, midnight.plusDays(1)))
            .isEqualTo(70);
    }

    @Test void emptyDay() {
        assertThat(Timeline.union(List.of(), midnight, midnight.plusDays(1))).isZero();
    }

    private Span span(long from, long to) {
        return new Span(midnight.plusMinutes(from), midnight.plusMinutes(to));
    }
}
