package cz.mzk.vera.login;

// ACCESS-login-return: keep only a VERA path after login.
public final class ReturnTo {
    private ReturnTo() {}

    public static String safe(String value) {
        if (value == null || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
            return "/";
        }
        String path = value.split("[?#]", 2)[0];
        if (path.equals("/login") || path.equals("/signed-out")) {
            return "/";
        }
        return value;
    }
}
