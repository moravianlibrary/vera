package cz.mzk.vera.pluginhost;

// PLG-api-outcome.
public sealed interface PluginOutcome<A>
        permits PluginOutcome.Answered, PluginOutcome.Unavailable, PluginOutcome.Refused {
    record Answered<A>(A answer) implements PluginOutcome<A> {}

    record Unavailable<A>(String detail) implements PluginOutcome<A> {}

    record Refused<A>(String code, String message) implements PluginOutcome<A> {}
}
