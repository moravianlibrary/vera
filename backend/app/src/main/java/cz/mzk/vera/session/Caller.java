package cz.mzk.vera.session;

/** The verified identity carried by this request. */
public record Caller(String userId, String tokenHash, String token) {}
