package timefolio;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@MappedSuperclass
abstract class Stored {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;
}

@Entity @Table(name = "users")
class Account extends Stored {
    String email;
    String passwordHash;
}

@Entity @Table(name = "categories")
class Category extends Stored {
    long userId;
    String name;
    String color;
    String icon;
}

@Entity @Table(name = "activity_entries")
class Entry extends Stored {
    long userId;
    long categoryId;
    String title;
    LocalDateTime startedAt;
    LocalDateTime endedAt;
    String kind;
    String memo;
}
