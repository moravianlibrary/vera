package cz.mzk.vera.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// MSG-handoff: provide the public origin used for links carried by Message plugins.
@Component
public record PublicUrl(@Value("${vera.public-url}") String value) {}
