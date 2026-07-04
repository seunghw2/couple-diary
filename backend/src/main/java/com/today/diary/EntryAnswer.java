package com.today.diary;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "entry_answers")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EntryAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private DiaryEntry entry;

    @Column(name = "question_id")
    private Long questionId;

    @Column(name = "prompt_key")
    private String promptKey;

    @Column(length = 2000)
    private String text;

    @Builder
    public EntryAnswer(DiaryEntry entry, Long questionId, String promptKey, String text) {
        this.entry = entry;
        this.questionId = questionId;
        this.promptKey = promptKey;
        this.text = text;
    }
}
