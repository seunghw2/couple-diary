package com.today.common;

import java.security.SecureRandom;

public final class InviteCodes {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private InviteCodes() {}

    /** "TODAY-XXXX" 형식 — X는 대문자/숫자 8자. */
    public static String generate() {
        StringBuilder sb = new StringBuilder("TODAY-");
        for (int i = 0; i < 8; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
