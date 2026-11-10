package cz.mzk.vera.plugin.message;

import java.util.List;

// PLG-api-kinds: Message.
public record HandOffInput(List<String> recipients, String subject, String text) {}
