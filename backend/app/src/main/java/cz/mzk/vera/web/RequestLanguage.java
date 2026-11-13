package cz.mzk.vera.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

// UI-language; UI-names: the client says its language; Czech when it names neither.
public final class RequestLanguage {
    private RequestLanguage() {}

    public static String current() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return languageOf(attributes.getRequest().getHeader("Accept-Language"));
        }
        return "cs";
    }

    public static String languageOf(HttpServletRequest request) {
        return languageOf(request.getHeader("Accept-Language"));
    }

    public static String languageOf(String acceptLanguage) {
        if (acceptLanguage != null) {
            for (String preference : acceptLanguage.split(",")) {
                String language = preference.trim().split("[-;\\s]", 2)[0].toLowerCase(Locale.ROOT);
                if (language.equals("cs") || language.equals("en")) {
                    return language;
                }
            }
        }
        return "cs";
    }
}
