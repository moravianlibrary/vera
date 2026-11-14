package cz.mzk.vera.plugin;

// PLG-contract; PLG-api-version.
public final class ContractVersion {
    public static final String CURRENT = "1.2";

    private ContractVersion() {}

    public static boolean accepts(String declared) {
        if (declared == null || !declared.matches("[0-9]+\\.[0-9]+(?:\\.[0-9]+)?")) {
            return false;
        }
        String[] parts = declared.split("\\.");
        try {
            return Integer.parseInt(parts[0]) == 1 && Integer.parseInt(parts[1]) <= 2;
        } catch (NumberFormatException exception) {
            return false;
        }
    }
}
